import os
import json
import platform
import signal
import time
import logging
from scsession import SaltcornSession
from helpers import wait_for_port_open

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOCAL_TEST_PLUGIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "local-test-plugin")

TENANT = "py_test_tenant"
ADMIN_EMAIL = "admine@foo.com"
ADMIN_PASSWORD = "AhGGr6rhu45"
TENANT_BASE_URL = f"http://{TENANT}.localhost:3001/"


def _plugin_root_folder():
    """Compute the saltcorn plugins root folder, matching env-paths behavior."""
    if platform.system() == "Windows":
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        return os.path.join(base, "saltcorn-plugins", "Data")
    elif platform.system() == "Darwin":
        return os.path.join(
            os.path.expanduser("~"), "Library", "Application Support", "saltcorn-plugins"
        )
    else:  # Linux / CI
        base = os.environ.get(
            "XDG_DATA_HOME",
            os.path.join(os.path.expanduser("~"), ".local", "share"),
        )
        return os.path.join(base, "saltcorn-plugins")


class TestLocalPluginInstaller:
    @classmethod
    def setup_class(cls):
        SaltcornSession.reset_to_fixtures()
        SaltcornSession.cli("set-cfg", "tenants_unsafe_plugins", "true")
        _prev_node_env = os.environ.get("NODE_ENV")
        os.environ["NODE_ENV"] = "test"
        SaltcornSession.cli("create-tenant", TENANT)
        if _prev_node_env is None:
            del os.environ["NODE_ENV"]
        else:
            os.environ["NODE_ENV"] = _prev_node_env
        SaltcornSession.cli(
            "create-user", "-e", ADMIN_EMAIL, "-a", "-p", ADMIN_PASSWORD, "-t", TENANT
        )
        SaltcornSession.cli("install-plugin", "-d", LOCAL_TEST_PLUGIN, "-t", TENANT)
        cls.installed_plugin_pkg = os.path.join(
            _plugin_root_folder(),
            "plugins_folder",
            "@saltcorn",
            "local-test-plugin",
            "localversion",
            "package.json",
        )

        cls.sess = SaltcornSession(3001, env_vars={"SALTCORN_NWORKERS": "2"})

    @classmethod
    def teardown_class(cls):
        cls.sess.close()
        SaltcornSession.cli("rm-tenant", "-f", "-t", TENANT)

    def _login_as_tenant_admin(self):
        self.sess.base_url = TENANT_BASE_URL
        self.sess.get("/auth/login")
        self.sess.postForm(
            "/auth/login",
            {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "_csrf": self.sess.csrf(),
            },
            allow_redirects=True,
        )

    def test_plugin_installed_for_tenant(self):
        self._login_as_tenant_admin()
        self.sess.get("/plugins")
        assert self.sess.status == 200
        assert "local-test-plugin" in self.sess.content

    def test_plugin_changes_loaded_on_restart(self):
        pkg_path = os.path.join(LOCAL_TEST_PLUGIN, "package.json")
        with open(pkg_path) as f:
            original_content = f.read()
        original_pkg = json.loads(original_content)
        modified_pkg = {**original_pkg, "version": "0.2.0"}
        try:
            with open(pkg_path, "w") as f:
                json.dump(modified_pkg, f, indent=2)

            # restart the server so installedLocalPlugins Set is cleared
            self.sess.close()
            self.sess.open()

            # verify the localversion dir was re-copied from the modified source
            assert os.path.exists(self.installed_plugin_pkg), (
                f"localversion package.json not found at {self.installed_plugin_pkg}"
            )
            with open(self.installed_plugin_pkg) as f:
                installed_pkg = json.load(f)
            assert installed_pkg["version"] == "0.2.0", (
                f"Expected version 0.2.0 after restart, got {installed_pkg.get('version')}"
            )

            # verify the plugin is still active for the tenant via HTTP
            self._login_as_tenant_admin()
            self.sess.get("/plugins")
            assert self.sess.status == 200
            assert "local-test-plugin" in self.sess.content
        finally:
            with open(pkg_path, "w") as f:
                f.write(original_content)

    def test_plugin_changes_loaded_on_sighup(self):
        """SIGHUP must reload plugins and state in all tenants without restarting."""
        pid = self.sess.salcorn_process.pid
        assert pid is not None, "Server process should be running"

        os.kill(pid, signal.SIGHUP)

        # give the master time to call refresh_plugins() for all tenants
        time.sleep(5)

        # the original process must still be alive — SIGHUP reloads, not restarts
        assert self.sess.salcorn_process.poll() is None, (
            "Server process must still be running after SIGHUP (no restart expected)"
        )

        # server must still accept connections
        wait_for_port_open(TENANT_BASE_URL)

        # plugin must still be active for the tenant after the reload
        self._login_as_tenant_admin()
        self.sess.get("/plugins")
        assert self.sess.status == 200
        assert "local-test-plugin" in self.sess.content

    def test_sighup_picks_up_plugin_js_changes(self):
        """SIGHUP must re-import plugin JS from disk so in-code changes are live
        without a server restart.  We add 'ready_for_mobile: true' to the
        plugin source index.js; SIGHUP re-copies it into localversion and
        re-imports with cache-busting, so the Mobile badge must appear."""
        # modify the SOURCE — on SIGHUP the master re-copies source → localversion
        index_js_path = os.path.join(LOCAL_TEST_PLUGIN, "index.js")

        with open(index_js_path) as f:
            original_index = f.read()

        modified_index = (
            "module.exports = {\n"
            "  sc_plugin_api_version: 1,\n"
            '  plugin_name: "local-test-plugin",\n'
            "  ready_for_mobile: true\n"
            "};\n"
        )
        try:
            with open(index_js_path, "w") as f:
                f.write(modified_index)

            pid = self.sess.salcorn_process.pid
            os.kill(pid, signal.SIGHUP)

            # wait for the reload
            time.sleep(5)

            assert self.sess.salcorn_process.poll() is None, (
                "Server must still be running after SIGHUP"
            )
            wait_for_port_open(TENANT_BASE_URL)

            self._login_as_tenant_admin()
            self.sess.get("/plugins")
            assert self.sess.status == 200

            # The Mobile badge must appear inside the local-test-plugin card
            content = self.sess.content
            plugin_card_start = content.find("@saltcorn/local-test-plugin")
            assert plugin_card_start != -1, (
                "@saltcorn/local-test-plugin card not found on /plugins page"
            )
            card_snippet = content[plugin_card_start : plugin_card_start + 2000]
            assert 'plugin-store">Mobile</span>' in card_snippet, (
                "Mobile badge not found after SIGHUP reload of ready_for_mobile:true"
            )
        finally:
            with open(index_js_path, "w") as f:
                f.write(original_index)

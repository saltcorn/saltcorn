import os
import json
import platform
import logging
from scsession import SaltcornSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LOCAL_TEST_PLUGIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "local-test-plugin")

TENANT = "_py_test_tenant_"
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

        cls.sess = SaltcornSession(3001)

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

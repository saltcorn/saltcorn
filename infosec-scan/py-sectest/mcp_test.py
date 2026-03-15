import re
import json
import asyncio
import logging
from scsession import SaltcornSession
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MCP_SERVER_PLUGIN = "@saltcorn/mcp-server"
AGENTS_PLUGIN = "@saltcorn/agents"

ADMIN_EMAIL = "admin@foo.com"
ADMIN_PASSWORD = "AhGGr6rhu45"
MCP_URL = "http://localhost:3001/mcp"


class TestMcpServer:
    @classmethod
    def setup_class(cls):
        SaltcornSession.reset_to_fixtures()
        SaltcornSession.cli("install-plugin", AGENTS_PLUGIN)
        SaltcornSession.cli("install-plugin", MCP_SERVER_PLUGIN)
        cls.sess = SaltcornSession(port=3001)
        cls._login(cls)

    @classmethod
    def teardown_class(cls):
        cls.sess.close()

    def _login(self):
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

    def _create_agent_trigger(self):
        """Create an Agent trigger and return its id."""
        self.sess.get("/actions/new")
        self.sess.postForm(
            "/actions/new",
            {
                "name": "mcp_test_agent",
                "action": "Agent",
                "when_trigger": "Never",
                "_csrf": self.sess.csrf(),
            },
            allow_redirects=False,
        )
        # response redirects to /actions/configure/:id
        assert self.sess.status in (301, 302), f"Expected redirect, got {self.sess.status}"
        m = re.search(r"/actions/configure/(\d+)", self.sess.redirect_url)
        assert m, f"Could not find trigger id in redirect: {self.sess.redirect_url}"
        return int(m.group(1))

    def _configure_agent_trigger(self, trigger_id):
        """Configure the agent trigger with a RunJsCode skill that inserts a row into albums."""
        insert_js = (
            "const albums = await Table.findOne({ name: 'albums' });"
            "const albumName = Math.random().toString(36).slice(2);"
            "await albums.insertRow({ name: albumName, release_date: new Date() });"
            "console.log('Inserted album:', albumName);"
            "return albumName;"
        )
        self.sess.get(f"/actions/configure/{trigger_id}")
        self.sess.postForm(
            f"/actions/configure/{trigger_id}",
            {
                "_csrf": self.sess.csrf(),
                "sys_prompt": "",
                "model": "",
                # FieldRepeat skill at index 0
                "skill_type_0": "Run JavaScript code",
                "mode_0": "Tool",
                "tool_name_0": "insert_album",
                "tool_description_0": "Insert a new album row with a random name and the current time as release date",
                "js_code_0": insert_js,
                "add_sys_prompt_0": "",
            },
            allow_redirects=True,
        )
        assert self.sess.status == 200, f"Configure failed with status {self.sess.status}"

    def test_list_tools(self):
        trigger_id = self._create_agent_trigger()
        self._configure_agent_trigger(trigger_id)

        async def run():
            async with streamablehttp_client(MCP_URL) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    result = await session.list_tools()
                    tool_names = [t.name for t in result.tools]
                    logger.info("Available tools: %s", tool_names)
                    assert "insert_album" in tool_names, f"log_time not found in {tool_names}"

        asyncio.run(run())

    def test_call_tool(self):
        trigger_id = self._create_agent_trigger()
        self._configure_agent_trigger(trigger_id)

        async def run():
            async with streamablehttp_client(MCP_URL) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    call_result = await session.call_tool("insert_album", {})
                    assert not call_result.isError, f"Tool call failed: {call_result.content}"
                    logger.info("Tool call result: %s", call_result.content)

        asyncio.run(run())

        # verify the album was written to the db
        self.sess.get("/api/albums?fields=name,release_date")
        albums = json.loads(self.sess.content).get("success", [])
        logger.info("Albums in db: %s", [a["name"] for a in albums])
        assert len(albums) > 0, "No albums found after tool call"

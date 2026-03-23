import re
import json
import asyncio
import logging
import pytest
import httpx
from scsession import SaltcornSession
from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MCP_SERVER_PLUGIN = "@saltcorn/mcp-server"
AGENTS_PLUGIN = "@saltcorn/agents"

ADMIN_EMAIL = "admin@foo.com"
ADMIN_PASSWORD = "AhGGr6rhu45"
MCP_URL = "http://localhost:3001/mcp"


def auth_client(token):
    return httpx.AsyncClient(headers={"Authorization": f"Bearer {token}"})


class Test:
    @classmethod
    def setup_class(cls):
        SaltcornSession.reset_to_fixtures()
        SaltcornSession.cli("install-plugin", "-p", AGENTS_PLUGIN)
        SaltcornSession.cli("install-plugin", "-p", MCP_SERVER_PLUGIN)
        cls.api_token = SaltcornSession.cli("modify-user", "-g", ADMIN_EMAIL)
        cls.staff_api_token = SaltcornSession.cli("modify-user", "-g", "staff@foo.com")
        logger.info("API token: %s", cls.api_token)
        cls.sess = SaltcornSession(port=3001)
        cls._login(cls)
        trigger_id = cls._create_agent_trigger(cls)
        cls._configure_agent_trigger(cls, trigger_id)

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
                "when_trigger": "API call",
                "min_role": "1",
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

    def test_no_token_is_rejected(self):
        """Requests without a bearer token must be rejected with 401."""
        async def run():
            async with streamable_http_client(MCP_URL) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

        with pytest.raises(Exception) as exc_info:
            asyncio.run(run())
        exc = exc_info.value
        all_messages = str(exc) + "".join(
            str(e) for e in getattr(exc, "exceptions", [])
        )
        assert "401" in all_messages, f"Expected 401, got: {exc}"

    def test_wrong_token_is_rejected(self):
        """Requests with an invalid bearer token must be rejected with 401."""
        async def run():
            async with streamable_http_client(
                MCP_URL, http_client=httpx.AsyncClient(headers={"Authorization": "Bearer invalid-token"})
            ) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

        with pytest.raises(Exception) as exc_info:
            asyncio.run(run())
        exc = exc_info.value
        all_messages = str(exc) + "".join(
            str(e) for e in getattr(exc, "exceptions", [])
        )
        assert "401" in all_messages, f"Expected 401, got: {exc}"

    def test_list_tools(self):
        async def run():
            async with streamable_http_client(
                MCP_URL, http_client=auth_client(self.__class__.api_token)
            ) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    result = await session.list_tools()
                    tool_names = [t.name for t in result.tools]
                    logger.info("Available tools: %s", tool_names)
                    assert "insert_album" in tool_names, f"insert_album not found in {tool_names}"

        asyncio.run(run())

    def test_call_tool(self):
        async def run():
            async with streamable_http_client(
                MCP_URL, http_client=auth_client(self.__class__.api_token)
            ) as (read, write, _):
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

    def test_insufficient_role_cannot_see_tool(self):
        """Staff (role_id=40) must not see tools from a trigger with min_role=1 (admin)."""
        async def run():
            async with streamable_http_client(
                MCP_URL, http_client=auth_client(self.__class__.staff_api_token)
            ) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    result = await session.list_tools()
                    tool_names = [t.name for t in result.tools]
                    logger.info("Tools visible to staff: %s", tool_names)
                    assert "insert_album" not in tool_names, (
                        f"insert_album should not be visible to staff, got: {tool_names}"
                    )

        asyncio.run(run())

    def test_name_collision_gets_suffixed(self):
        """Two triggers with the same tool name must appear as _01 and _02."""
        trigger_id = self._create_agent_trigger()
        self._configure_agent_trigger(trigger_id)

        async def run():
            async with streamable_http_client(
                MCP_URL, http_client=auth_client(self.__class__.api_token)
            ) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    result = await session.list_tools()
                    tool_names = [t.name for t in result.tools]
                    logger.info("Tools with collision: %s", tool_names)
                    assert "insert_album_01" in tool_names, f"insert_album_01 not found in {tool_names}"
                    assert "insert_album_02" in tool_names, f"insert_album_02 not found in {tool_names}"
                    assert "insert_album" not in tool_names, f"unsuffixed insert_album should not exist: {tool_names}"

        asyncio.run(run())

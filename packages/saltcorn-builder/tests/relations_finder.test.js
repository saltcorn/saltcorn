import React from "react";
import renderer from "react-test-renderer";

import {
  fixturesData,
  withAnotherUserField,
  withSecondTopicField,
  withMultipleInbounds,
  withKeyFromLayerTwo,
  withKeyFromLayerThree,
  withSimplePostTopicrelation,
} from "@saltcorn/common-code/tests/test_data";

import {
  expectedOne,
  expectedTwo,
  expectedThree,
  expectedFour,
  expectedFive,
  expectedSix,
} from "@saltcorn/common-code/tests/expected_relations";
import { ViewSettings } from "../src/components/elements/View";
import { ViewLinkSettings } from "../src/components/elements/ViewLink";

jest.mock("@craftjs/core", () => ({
  useNode: jest.fn(),
}));

const doTest = (
  tables,
  views,
  tableName,
  viewName,
  expected,
  excludedTemplates,
  view,
  relation
) => {
  // mock craftjs
  const useNodeMock = jest.fn();
  useNodeMock.mockReturnValue({
    actions: {
      setProp: (fn) => {},
    },
    relation: relation,
    view: view || viewName,
    name: view || viewName,
  });
  require("@craftjs/core").useNode.mockImplementation(useNodeMock);
  let relationsCache = {};
  const setRelationsCache = (newVal) => {
    relationsCache = newVal;
  };
  // mock react context
  const useContextMock = (React.useContext = jest.fn());
  useContextMock.mockReturnValue({
    // optionsCtx part
    tables: tables,
    views: views,
    tableName: tableName,
    roles: [],
    excluded_subview_templates: excludedTemplates,
    // relationsCtx part
    relationsCache: relationsCache,
    setRelationsCache: setRelationsCache,
  });
  // spy on useState and extract the relations (first call)
  const spy = jest.spyOn(React, "useState");
  renderer.create(<ViewSettings></ViewSettings>);
  expect(spy).toBeCalled();
  const vCallArgs = spy.mock.calls[0];
  expect(vCallArgs[0].relations).toBeDefined();
  expect(vCallArgs[0].relations).toHaveLength(expected.length);
  expect(vCallArgs[0].relations.map((rel) => rel.relationString)).toEqual(
    expect.arrayContaining(expected)
  );

  renderer.create(<ViewLinkSettings></ViewLinkSettings>);
  expect(spy.mock.calls).toHaveLength(4);
  const vLinkcallArgs = spy.mock.calls[2];
  expect(vLinkcallArgs[0].relations).toBeDefined();
  expect(vLinkcallArgs[0].relations).toHaveLength(expected.length);
  expect(vLinkcallArgs[0].relations.map((rel) => rel.relationString)).toEqual(
    expect.arrayContaining(expected)
  );
};

describe("relations tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });
  describe("single relations", () => {
    it("parent relations", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [".fan_club.artist"];
      doTest(tables, views, "fan_club", "show_artist", expected);
    });

    it("parent relations with layers", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [".patients.favbook.publisher"];
      doTest(tables, views, "patients", "show_publisher", expected);
    });

    it("one to one relations", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [".covers.albums$cover"];
      doTest(tables, views, "covers", "show_album", expected);
    });

    it("employee department relation", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [".employee", ".employee.department.manager"];
      doTest(tables, views, "employee", "show_manager", expected);
    });
  });

  describe("multi relations", () => {
    describe("inbound relations", () => {
      it("single keys to source and rel table", () => {
        const { tables, views } = fixturesData(__dirname);
        doTest(tables, views, "users", "blog_in_topic_feed", expectedOne);
      });

      it("multiple keys to source and single key to rel table", () => {
        const { tables, views } = withAnotherUserField(__dirname);
        doTest(tables, views, "users", "blog_in_topic_feed", expectedTwo);
      });

      it("multiple keys to source and rel table", () => {
        const { tables, views } = withSecondTopicField(__dirname);
        doTest(tables, views, "users", "blog_in_topic_feed", expectedThree);
      });

      it("multiple inbound tables", () => {
        const { tables, views } = withMultipleInbounds(__dirname);
        doTest(tables, views, "users", "blog_in_topic_feed", expectedFour);
      });

      it("key to source from layer two", () => {
        const { tables, views } = withKeyFromLayerTwo(__dirname);
        doTest(tables, views, "users", "blog_in_topic_feed", expectedFive);
      });

      it("three levels inbound", () => {
        const { tables, views } = withKeyFromLayerThree(__dirname);
        doTest(tables, views, "users", "blog_in_topic_feed", expectedSix);
      });

      it("simple post topic relation", () => {
        const expected = [
          ".",
          ".users.favsimpletopic.simple_posts$topic",
          ".users.favsimpletopic.simple_post_inbound$topic.post",
          ".users.messages$user.room.participants$room.user.favsimpletopic.simple_posts$topic",
          ".users.messages$user.room.participants$room.user.favsimpletopic.simple_post_inbound$topic.post",
        ];
        const { tables, views } = withSimplePostTopicrelation(__dirname);
        doTest(tables, views, "users", "simple_posts_list", expected);
      });
    });

    describe("many to many relations", () => {
      it("artist_plays_on_album", () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [".", ".artists.artist_plays_on_album$artist.album"];
        doTest(tables, views, "artists", "albums_feed", expected);
      });

      it("tracks on album", () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [
          ".",
          ".artists.artist_plays_on_album$artist.album.tracks_on_album$album",
        ];
        doTest(tables, views, "artists", "tracks_on_album_feed", expected);
      });

      it("show pressing_job with embedded fan club feed", () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [
          ".",
          ".pressing_job.album.artist_plays_on_album$album.artist.fan_club$artist",
        ];
        doTest(tables, views, "pressing_job", "fan_club_feed", expected);
      });
    });

    describe("excluded viewtemplates", () => {
      it("excluded viewtemplates", () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [];
        const excluded = ["Room"];
        doTest(tables, views, "participants", "rooms_view", expected, excluded);
      });
    });

    describe("open legacy relations", () => {
      it("ChildList", async () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [".", ".books.discusses_books$book"];
        doTest(
          tables,
          views,
          "books",
          "disc_books_list",
          expected,
          [],
          "ChildList:disc_books_list.discusses_books.book",
          undefined
        );
      });

      it("Independent", async () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [
          ".",
          ".blog_posts",
          ".blog_posts.blog_in_topic$post.topic.inbound_inbound$topic.bp_inbound.post",
        ];
        doTest(
          tables,
          views,
          "blog_posts",
          "blog_posts_feed",
          expected,
          [],
          "Independent:blog_posts_feed",
          undefined
        );
      });

      it("Own", async () => {
        const { tables, views } = fixturesData(__dirname);
        const expected = [".books"];
        doTest(
          tables,
          views,
          "books",
          "authorshow",
          expected,
          [],
          "Own:authorshow",
          undefined
        );
      });
    });
  });
});

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
} from "./test_data";
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
    view: view,
    name: view,
    view_name: viewName,
  });
  require("@craftjs/core").useNode.mockImplementation(useNodeMock);
  // mock react context
  const useContextMock = (React.useContext = jest.fn());
  useContextMock.mockReturnValue({
    tables: tables,
    views: views,
    tableName: tableName,
    roles: [],
    excluded_subview_templates: excludedTemplates,
  });
  // spy on useState and extract the relations (first call)
  const spy = jest.spyOn(React, "useState");
  renderer.create(<ViewSettings></ViewSettings>);
  expect(spy).toBeCalled();
  const vCallArgs = spy.mock.calls[0];
  expect(vCallArgs[0].paths).toBeDefined();
  expect(vCallArgs[0].paths).toHaveLength(expected.length);
  expect(vCallArgs[0].paths).toEqual(expect.arrayContaining(expected));

  renderer.create(<ViewLinkSettings></ViewLinkSettings>);
  expect(spy.mock.calls).toHaveLength(4);
  const vLinkcallArgs = spy.mock.calls[2];
  expect(vLinkcallArgs[0].paths).toBeDefined();
  expect(vLinkcallArgs[0].paths).toHaveLength(expected.length);
  expect(vLinkcallArgs[0].paths).toEqual(expect.arrayContaining(expected));
};

describe("relations tests", () => {
  beforeAll(() => {
    // inject relationHelpers (normally it's a script tag)
    global.relationHelpers = {
      ...require("../../server/public/relation_helpers.js"),
    };
  });
  beforeEach(() => {
    jest.restoreAllMocks();
  });
  describe("single relations", () => {
    it("parent relations", async () => {
      const { tables, views } = fixturesData();
      const expected = [".fan_club.artist"];
      doTest(tables, views, "fan_club", "show_artist", expected);
    });

    it("one to one relations", async () => {
      const { tables, views } = fixturesData();
      const expected = [".covers.albums$cover"];
      doTest(tables, views, "covers", "show_album", expected);
    });

    it("employee department relation", async () => {
      const { tables, views } = fixturesData();
      const expected = [".employee", ".employee.department.manager"];
      doTest(tables, views, "employee", "show_manager", expected);
    });
  });

  describe("multi relations", () => {
    describe("inbound relations", () => {
      const expectedOne = [
        ".",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.bp_inbound.post.blog_in_topic$post",
        ".users.messages$user.room.participants$room.user.user_interested_in_topic$user.topic.blog_in_topic$topic",
      ];
      it("single keys to source and rel table", async () => {
        const { tables, views } = fixturesData();
        doTest(tables, views, "users", "blog_in_topic_feed", expectedOne);
      });

      const expectedTwo = [
        ...expectedOne,
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post.blog_in_topic$post",
        ".users.messages$user.room.participants$room.user.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
      ];
      it("multiple keys to source and single key to rel table", async () => {
        const { tables, views } = withAnotherUserField();
        doTest(tables, views, "users", "blog_in_topic_feed", expectedTwo);
      });

      const expectedThree = [
        ...expectedTwo,
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
        ".users.messages$user.room.participants$room.user.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
        ".users.messages$user.room.participants$room.user.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
      ];
      it("multiple keys to source and rel table", async () => {
        const { tables, views } = withSecondTopicField();
        doTest(tables, views, "users", "blog_in_topic_feed", expectedThree);
      });

      const expectedFour = [
        ...expectedThree,
        ".users.user_interested_in_topic$user.another_user.second_inbound$user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$user.another_user.second_inbound$user.topic.blog_in_topic$second_topic",
        ".users.second_inbound$user.topic.blog_in_topic$topic",
        ".users.second_inbound$user.topic.blog_in_topic$second_topic",
        ".users.second_inbound$user.topic.inbound_inbound$topic.bp_inbound.post.blog_in_topic$post",
        ".users.messages$user.room.participants$room.user.second_inbound$user.topic.blog_in_topic$topic",
        ".users.messages$user.room.participants$room.user.second_inbound$user.topic.blog_in_topic$second_topic",
      ];
      it("multiple inbound tables", async () => {
        const { tables, views } = withMultipleInbounds();
        doTest(tables, views, "users", "blog_in_topic_feed", expectedFour);
      });

      const expectedFive = [
        ...expectedFour,
        ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
        ".users.second_inbound$user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$topic.post.inbound_inbound$post_from_layer_two.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$user.another_user.second_inbound$user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post.inbound_inbound$post_from_layer_two.topic.blog_in_topic$second_topic",
        ".users.second_inbound$user.topic.blog_in_topic$topic.post.inbound_inbound$post_from_layer_two.topic.blog_in_topic$second_topic",
      ];
      it("key to source from layer two", async () => {
        const { tables, views } = withKeyFromLayerTwo();
        doTest(tables, views, "users", "blog_in_topic_feed", expectedFive);
      });

      const expectedSix = [
        ...expectedFive,
        ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post.blog_in_topic$post",
        ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.post_from_layer_two.blog_in_topic$post",
        ".users.user_interested_in_topic$another_user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post.blog_in_topic$post",
        ".users.user_interested_in_topic$another_user.topic.inbound_level_three$topic.inbound_level_two.post_from_layer_two.blog_in_topic$post",
        ".users.second_inbound$user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post.blog_in_topic$post",
        ".users.second_inbound$user.topic.inbound_level_three$topic.inbound_level_two.post_from_layer_two.blog_in_topic$post",
      ];
      it("three levels inbound", async () => {
        const { tables, views } = withKeyFromLayerThree();
        doTest(tables, views, "users", "blog_in_topic_feed", expectedSix);
      });

      it("simple post topic relation", async () => {
        const expected = [
          ".",
          ".users.favsimpletopic.simple_posts$topic",
          ".users.favsimpletopic.simple_post_inbound$topic.post",
          ".users.messages$user.room.participants$room.user.favsimpletopic.simple_posts$topic",
          ".users.messages$user.room.participants$room.user.favsimpletopic.simple_post_inbound$topic.post",
        ];
        const { tables, views } = withSimplePostTopicrelation();
        doTest(tables, views, "users", "simple_posts_list", expected);
      });
    });

    describe("many to many relations", () => {
      it("artist_plays_on_album", async () => {
        const { tables, views } = fixturesData();
        const expected = [".", ".artists.artist_plays_on_album$artist.album"];
        doTest(tables, views, "artists", "albums_feed", expected);
      });

      it("tracks on album", async () => {
        const { tables, views } = fixturesData();
        const expected = [
          ".",
          ".artists.artist_plays_on_album$artist.album.tracks_on_album$album",
        ];
        doTest(tables, views, "artists", "tracks_on_album_feed", expected);
      });

      it("show pressing_job with embedded fan club feed", async () => {
        const { tables, views } = fixturesData();
        const expected = [
          ".",
          ".pressing_job.album.artist_plays_on_album$album.artist.fan_club$artist",
        ];
        doTest(tables, views, "pressing_job", "fan_club_feed", expected);
      });
    });

    describe("excluded viewtemplates", () => {
      it("excluded viewtemplates", async () => {
        const { tables, views } = fixturesData();
        const expected = [];
        const excluded = ["Room"];
        doTest(tables, views, "participants", "rooms_view", expected, excluded);
      });
    });

    describe("open legacy relations", () => {
      it("ChildList", async () => {
        const { tables, views } = fixturesData();
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
        const { tables, views } = fixturesData();
        const expected = [
          ".",
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
        const { tables, views } = fixturesData();
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

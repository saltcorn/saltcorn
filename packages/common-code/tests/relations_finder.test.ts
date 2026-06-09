import { describe, it } from "node:test";
import assert from "node:assert";

import {
  fixturesData,
  withAnotherUserField,
  withSecondTopicField,
  withMultipleInbounds,
  withKeyFromLayerTwo,
  withKeyFromLayerThree,
  withSimplePostTopicrelation,
} from "./test_data";

import {
  expectedOne,
  expectedTwo,
  expectedThree,
  expectedFour,
  expectedFive,
  expectedSix,
} from "./expected_relations";

import { RelationsFinder } from "../relations/relations_finder";

// jest's expect(actual).toEqual(expect.arrayContaining(expected)): every
// element of expected is present somewhere in actual (deep equality).
const assertArrayContaining = (actual: any[], expected: any[]) => {
  for (const item of expected) {
    assert.ok(
      actual.some((a) => {
        try {
          assert.deepStrictEqual(a, item);
          return true;
        } catch {
          return false;
        }
      }),
      `expected array to contain ${JSON.stringify(item)}`
    );
  }
};

describe("single relations", () => {
  it("parent relations", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    assert.deepStrictEqual(
      finder.singleRelationPaths("fan_club", "show_artist", []),
      [".fan_club.artist"]
    );
  });

  it("parent relations with layers", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    assert.deepStrictEqual(
      finder.singleRelationPaths("patients", "show_publisher", []),
      [".patients.favbook.publisher"]
    );
  });

  it("one to one relations", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    assert.deepStrictEqual(
      finder.singleRelationPaths("covers", "show_album", []),
      [".covers.albums$cover"]
    );
  });

  it("employee department relation", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    assert.deepStrictEqual(
      finder.singleRelationPaths("employee", "show_manager", []),
      [".employee", ".employee.department.manager"]
    );
  });
});

describe("multi relations", () => {
  describe("inbound relations", () => {
    it("single keys to source and rel table", () => {
      const { tables, views } = fixturesData(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      assert.strictEqual(result.length, expectedOne.length);
      assertArrayContaining(result, expectedOne);
    });

    it("multiple keys to source and single key to rel table", () => {
      const { tables, views } = withAnotherUserField(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      assert.strictEqual(result.length, expectedTwo.length);
      assertArrayContaining(result, expectedTwo);
    });

    it("multiple keys to source and rel table", () => {
      const { tables, views } = withSecondTopicField(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      assert.strictEqual(result.length, expectedThree.length);
      assertArrayContaining(result, expectedThree);
    });

    it("multiple inbound tables", () => {
      const { tables, views } = withMultipleInbounds(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      assert.strictEqual(result.length, expectedFour.length);
      assertArrayContaining(result, expectedFour);
    });

    it("key to source from layer two", () => {
      const { tables, views } = withKeyFromLayerTwo(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      assert.strictEqual(result.length, expectedFive.length);
      assertArrayContaining(result, expectedFive);
    });

    it("three levels inbound", async () => {
      const { tables, views } = withKeyFromLayerThree(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      assert.strictEqual(result.length, expectedSix.length);
      assertArrayContaining(result, expectedSix);
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
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "simple_posts_list",
        []
      );
      assert.strictEqual(result.length, expected.length);
      assertArrayContaining(result, expected);
    });
  });

  describe("many to many relations", () => {
    it("artist_plays_on_album", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [".", ".artists.artist_plays_on_album$artist.album"];
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths("artists", "albums_feed", []);
      assert.strictEqual(result.length, expected.length);
      assertArrayContaining(result, expected);
    });

    it("tracks on album", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [
        ".",
        ".artists.artist_plays_on_album$artist.album.tracks_on_album$album",
      ];
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "artists",
        "tracks_on_album_feed",
        []
      );
      assert.strictEqual(result.length, expected.length);
      assertArrayContaining(result, expected);
    });

    it("show pressing_job with embedded fan club feed", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [
        ".",
        ".pressing_job.album.artist_plays_on_album$album.artist.fan_club$artist",
      ];
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "pressing_job",
        "fan_club_feed",
        []
      );
      assert.strictEqual(result.length, expected.length);
      assertArrayContaining(result, expected);
    });
  });

  describe("excluded viewtemplates", () => {
    it("excluded viewtemplates", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected: any = [];
      const excluded = ["Room"];
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.singleRelationPaths(
        "participants",
        "rooms_view",
        excluded
      );
      assert.strictEqual(result.length, expected.length);
      assertArrayContaining(result, expected);
    });
  });
});

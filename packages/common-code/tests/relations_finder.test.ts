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

describe("single relations", () => {
  it("parent relations", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    expect(finder.singleRelationPaths("fan_club", "show_artist", [])).toEqual([
      ".fan_club.artist",
    ]);
  });

  it("parent relations with layers", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    expect(
      finder.singleRelationPaths("patients", "show_publisher", [])
    ).toEqual([".patients.favbook.publisher"]);
  });

  it("one to one relations", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    expect(finder.singleRelationPaths("covers", "show_album", [])).toEqual([
      ".covers.albums$cover",
    ]);
  });

  it("employee department relation", () => {
    const { tables, views } = fixturesData(__dirname);
    const finder = new RelationsFinder(tables, views, 6);
    expect(finder.singleRelationPaths("employee", "show_manager", [])).toEqual([
      ".employee",
      ".employee.department.manager",
    ]);
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
      expect(result).toHaveLength(expectedOne.length);
      expect(result).toEqual(expect.arrayContaining(expectedOne));
    });

    it("multiple keys to source and single key to rel table", () => {
      const { tables, views } = withAnotherUserField(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      expect(result).toHaveLength(expectedTwo.length);
      expect(result).toEqual(expect.arrayContaining(expectedTwo));
    });

    it("multiple keys to source and rel table", () => {
      const { tables, views } = withSecondTopicField(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      expect(result).toHaveLength(expectedThree.length);
      expect(result).toEqual(expect.arrayContaining(expectedThree));
    });

    it("multiple inbound tables", () => {
      const { tables, views } = withMultipleInbounds(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      expect(result).toHaveLength(expectedFour.length);
      expect(result).toEqual(expect.arrayContaining(expectedFour));
    });

    it("key to source from layer two", () => {
      const { tables, views } = withKeyFromLayerTwo(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      expect(result).toHaveLength(expectedFive.length);
      expect(result).toEqual(expect.arrayContaining(expectedFive));
    });

    it("three levels inbound", async () => {
      const { tables, views } = withKeyFromLayerThree(__dirname);
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths(
        "users",
        "blog_in_topic_feed",
        []
      );
      expect(result).toHaveLength(expectedSix.length);
      expect(result).toEqual(expect.arrayContaining(expectedSix));
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
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expect.arrayContaining(expected));
    });
  });

  describe("many to many relations", () => {
    it("artist_plays_on_album", () => {
      const { tables, views } = fixturesData(__dirname);
      const expected = [".", ".artists.artist_plays_on_album$artist.album"];
      const finder = new RelationsFinder(tables, views, 6);
      const result = finder.multiRelationPaths("artists", "albums_feed", []);
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expect.arrayContaining(expected));
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
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expect.arrayContaining(expected));
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
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expect.arrayContaining(expected));
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
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expect.arrayContaining(expected));
    });
  });
});

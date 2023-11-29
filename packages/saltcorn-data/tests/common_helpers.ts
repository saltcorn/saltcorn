import Table from "../models/table";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
import { assertIsSet } from "./assertions";

export async function prepareSimpleTopicPostRelation() {
  if (Table.findOne({ name: "simple_topics" })) return;
  const simpleTopic = await Table.create("simple_topics");
  const simplePost = await Table.create("simple_posts");
  const users = Table.findOne({ name: "users" });
  assertIsSet(users);

  await Field.create({
    table: simplePost,
    name: "body",
    type: "String",
    required: true,
  });
  await Field.create({
    table: simplePost,
    name: "title",
    type: "String",
    required: true,
  });
  await Field.create({
    table: simplePost,
    name: "topic",
    label: "Topic",
    type: "Key",
    reftable: simpleTopic,
    attributes: { summary_field: "name" },
  });
  await Field.create({
    table: simpleTopic,
    name: "name",
    type: "String",
    required: true,
  });
  await Field.create({
    table: users,
    name: "favsimpletopic",
    label: "Favorite Topic",
    type: "Key",
    reftable: simpleTopic,
    attributes: { summary_field: "name" },
  });

  await View.create({
    table_id: simplePost.id,
    name: "simple_posts_lists",
    viewtemplate: "List",
    configuration: {
      columns: [
        { type: "Field", field_name: "body", state_field: "on" },
        { type: "Field", field_name: "title", state_field: "on" },
      ],
    },
    min_role: 100,
  });
  await View.create({
    table_id: users.id,
    name: "show_user_with_simple_posts_list",
    viewtemplate: "Show",
    configuration: {
      columns: [],
      layout: {
        above: [
          {
            type: "view",
            view: "simple_posts_lists",
            relation: ".users.favsimpletopic.simple_posts$topic",
            name: "bc653",
            state: "shared",
          },
        ],
      },
    },
    min_role: 100,
  });

  await db.insert("simple_topics", {
    name: "simple topic A",
  });
  await db.insert("simple_topics", {
    name: "simple topic B",
  });
  await db.insert("simple_topics", {
    name: "empty topic",
  });
  await db.insert("simple_posts", {
    body: "first post in topic A",
    title: "fpitA",
    topic: 1,
  });
  await db.insert("simple_posts", {
    body: "second post in topic A",
    title: "spitA",
    topic: 1,
  });
  await db.insert("simple_posts", {
    body: "post in topic B",
    title: "pitB",
    topic: 2,
  });
  await db.update(
    "users",
    {
      favsimpletopic: 1,
    },
    1
  );
  await db.update(
    "users",
    {
      favsimpletopic: 3,
    },
    3
  );

  // alternative with levels
  const simplePostInbound = await Table.create("simple_post_inbound");
  await Field.create({
    table: simplePostInbound,
    name: "post",
    label: "Post",
    type: "Key",
    reftable: simplePost,
    attributes: { summary_field: "title" },
  });
  await Field.create({
    table: simplePostInbound,
    name: "topic",
    label: "Topic",
    type: "Key",
    reftable: simpleTopic,
    attributes: { summary_field: "name" },
  });
  await View.create({
    table_id: users.id,
    name: "show_user_with_simple_posts_list_levels",
    viewtemplate: "Show",
    configuration: {
      columns: [],
      layout: {
        above: [
          {
            type: "view",
            view: "simple_posts_lists",
            relation: ".users.favsimpletopic.simple_post_inbound$topic.post",
            name: "bc653",
            state: "shared",
          },
        ],
      },
    },
    min_role: 100,
  });
  await db.insert("simple_post_inbound", {
    post: 1,
    topic: 1,
  });
}

export async function prepareEmployeeDepartment() {
  const department = await Table.create("department");
  const employee = await Table.create("employee");
  const company = await Table.create("company");
  await Field.create({
    table: company,
    name: "name",
    label: "Name",
    type: "String",
    required: true,
  });

  await Field.create({
    table: department,
    name: "company",
    reftable: company,
    label: "Company",
    type: "Key",
    attributes: { summary_field: "name" },
  });
  await Field.create({
    table: department,
    name: "manager",
    reftable: employee,
    label: "Manager",
    type: "Key",
    is_unique: true,
    attributes: { summary_field: "name" },
  });
  await Field.create({
    table: department,
    name: "name",
    label: "Name",
    type: "String",
    required: true,
  });

  await Field.create({
    table: employee,
    name: "name",
    label: "Name",
    type: "String",
    required: true,
  });
  await Field.create({
    table: employee,
    name: "department",
    reftable: department,
    label: "Department",
    type: "Key",
    attributes: { summary_field: "name" },
  });

  await db.insert("company", {
    name: "my_company",
  });

  await db.insert("department", {
    name: "my_department",
    company: 1,
  });
  await db.insert("employee", {
    name: "manager",
    department: 1,
  });
  await db.insert("employee", {
    name: "my_employee",
    department: 1,
  });
  await db.update(
    "department",
    {
      manager: 1,
    },
    1
  );

  await View.create({
    table_id: employee.id,
    name: "show_manager",
    viewtemplate: "Show",
    configuration: {
      columns: [{ type: "Field", field_name: "name", state_field: "on" }],
      layout: {
        above: [{ type: "field", fieldview: "show", field_name: "name" }],
      },
    },
    min_role: 100,
  });

  await View.create({
    table_id: employee.id,
    name: "show_employee",
    viewtemplate: "Show",
    configuration: {
      columns: [{ type: "Field", field_name: "name", state_field: "on" }],
      layout: {
        above: [
          { type: "field", fieldview: "show", field_name: "name" },
          {
            type: "view",
            view: "show_manager",
            relation: ".employee.department.manager",
            name: "bc653",
            state: "shared",
          },
        ],
      },
    },
    min_role: 100,
  });
}

export async function prepareArtistsAlbumRelation() {
  const artists = await Table.create("artists");
  const albums = await Table.create("albums");
  const artistPlaysOnAlbum = await Table.create("artist_plays_on_album");
  await Field.create({
    table: artists,
    name: "name",
    label: "Name",
    type: "String",
    required: true,
  });
  await Field.create({
    table: artists,
    name: "birth_data",
    label: "Birth data",
    type: "Date",
    required: true,
  });

  await Field.create({
    table: albums,
    name: "name",
    label: "Name",
    type: "String",
    required: true,
  });
  await Field.create({
    table: albums,
    name: "release_date",
    label: "Release date",
    type: "Date",
    required: true,
  });

  await Field.create({
    table: artistPlaysOnAlbum,
    name: "artist",
    reftable: artists,
    label: "Artist",
    type: "Key",
    attributes: { summary_field: "name" },
  });
  await Field.create({
    table: artistPlaysOnAlbum,
    name: "album",
    reftable: albums,
    label: "Album",
    type: "Key",
    attributes: { summary_field: "name" },
  });

  await db.insert("artists", {
    name: "artist A",
    birth_data: new Date("2000-11-11T10:34:00.000Z"),
  });
  await db.insert("artists", {
    name: "artist B",
    birth_data: new Date("2000-11-11T10:34:00.000Z"),
  });
  await db.insert("albums", {
    name: "album A",
    release_date: new Date("2010-11-11T10:34:00.000Z"),
  });
  await db.insert("albums", {
    name: "album B",
    release_date: new Date("2010-11-11T10:34:00.000Z"),
  });
  await db.insert("artist_plays_on_album", {
    artist: 1,
    album: 1,
  });
  await db.insert("artist_plays_on_album", {
    artist: 1,
    album: 2,
  });
  await db.insert("artist_plays_on_album", {
    artist: 2,
    album: 1,
  });

  await View.create({
    table_id: albums.id,
    name: "edit_album",
    viewtemplate: "Edit",
    configuration: {
      columns: [{ type: "Field", field_name: "name", state_field: "on" }],
      layout: {
        above: [{ type: "field", fieldview: "show", field_name: "name" }],
      },
    },
    min_role: 100,
  });

  await View.create({
    table_id: albums.id,
    name: "albums_feed",
    viewtemplate: "Feed",
    configuration: {
      cols_lg: 1,
      cols_md: 1,
      cols_sm: 1,
      cols_xl: 1,
      in_card: false,
      viewname: "albums_feed",
      show_view: "edit_album",
      descending: false,
      view_to_create: "edit_album",
      create_view_display: "Link",
    },
    min_role: 100,
  });

  await View.create({
    table_id: artists.id,
    name: "show_artist",
    viewtemplate: "Show",
    configuration: {
      columns: [{ type: "Field", field_name: "name", state_field: "on" }],
      layout: {
        above: [
          { type: "field", fieldview: "show", field_name: "name" },
          {
            name: "d7603a",
            type: "view",
            view: "albums_feed",
            state: "shared",
            relation: ".artists.artist_plays_on_album$artist.album",
            configuration: {},
          },
        ],
      },
    },
    min_role: 100,
  });
}

export async function createAnotherUserField() {
  if ((await Field.find({ name: "another_user" })).length === 0) {
    const uiit = Table.findOne({ name: "user_interested_in_topic" });
    await Field.create({
      table: uiit,
      name: "another_user",
      label: "Another_User",
      type: "Key",
      reftable_name: "users",
      required: false,
      attributes: { summary_field: "email" },
    });
  }
}

export async function createSecondTopicField() {
  if ((await Field.find({ name: "second_topic" })).length === 0) {
    const bit = Table.findOne({ name: "blog_in_topic" });
    const topics = Table.findOne({ name: "topics" });
    assertIsSet(bit);
    assertIsSet(topics);
    await Field.create({
      table: bit,
      name: "second_topic",
      label: "Second Topic",
      type: "Key",
      reftable: topics,
      required: false,
      attributes: { summary_field: "name" },
    });
  }
}

export async function createMultipleInbounds() {
  if (!Table.findOne({ name: "second_inbound" })) {
    const second_inbound = await Table.create("second_inbound");
    await Field.create({
      table: second_inbound,
      name: "topic",
      label: "Topic",
      type: "Key",
      reftable_name: "topics",
      required: false,
      attributes: { summary_field: "name" },
    });
    await Field.create({
      table: second_inbound,
      name: "user",
      label: "User",
      type: "Key",
      reftable_name: "users",
      required: false,
      attributes: { summary_field: "email" },
    });
  }
}

export async function createKeyFromLevelTwo() {
  if ((await Field.find({ name: "post_from_level_two" })).length === 0) {
    const inbound_inbound = Table.findOne({ name: "inbound_inbound" });
    assertIsSet(inbound_inbound);
    const blog_posts = Table.findOne({ name: "blog_posts" });
    assertIsSet(blog_posts);
    await Field.create({
      table: inbound_inbound,
      name: "post_from_level_two",
      label: "Post from level two",
      type: "Key",
      reftable: blog_posts,
      attributes: { summary_field: "post" },
    });
  }
}

export async function createLevelThreeInbound() {
  if (!Table.findOne({ name: "inbound_level_three" })) {
    const levelThreeInbound = await Table.create("inbound_level_three");
    const inbound_inbound = Table.findOne({ name: "inbound_inbound" });
    assertIsSet(inbound_inbound);
    const topics = Table.findOne({ name: "topics" });
    assertIsSet(topics);
    await Field.create({
      table: levelThreeInbound,
      name: "inbound_level_two",
      reftable: inbound_inbound,
      label: "inbound to level 2",
      type: "Key",
      attributes: { summary_field: "id" },
    });
    await Field.create({
      table: levelThreeInbound,
      name: "topic",
      reftable: topics,
      label: "Topic",
      type: "Key",
      attributes: { summary_field: "id" },
    });
  }
}

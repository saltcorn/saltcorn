export const expectedOne = [
  ".",
  ".users.user_interested_in_topic$user.topic.blog_in_topic$topic",
  ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.bp_inbound.post.blog_in_topic$post",
  ".users.messages$user.room.participants$room.user.user_interested_in_topic$user.topic.blog_in_topic$topic",
];

export const expectedTwo = [
  ...expectedOne,
  ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
  ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post.blog_in_topic$post",
  ".users.messages$user.room.participants$room.user.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
];

export const expectedThree = [
  ...expectedTwo,
  ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
  ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
  ".users.messages$user.room.participants$room.user.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
  ".users.messages$user.room.participants$room.user.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
];

export const expectedFour = [
  ...expectedThree,
  ".users.user_interested_in_topic$user.another_user.second_inbound$user.topic.blog_in_topic$topic",
  ".users.user_interested_in_topic$user.another_user.second_inbound$user.topic.blog_in_topic$second_topic",
  ".users.second_inbound$user.topic.blog_in_topic$topic",
  ".users.second_inbound$user.topic.blog_in_topic$second_topic",
  ".users.second_inbound$user.topic.inbound_inbound$topic.bp_inbound.post.blog_in_topic$post",
  ".users.messages$user.room.participants$room.user.second_inbound$user.topic.blog_in_topic$topic",
  ".users.messages$user.room.participants$room.user.second_inbound$user.topic.blog_in_topic$second_topic",
];

export const expectedFive = [
  ...expectedFour,
  ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
  ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
  ".users.second_inbound$user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
  ".users.user_interested_in_topic$user.topic.blog_in_topic$topic.post.inbound_inbound$post_from_layer_two.topic.blog_in_topic$second_topic",
  ".users.user_interested_in_topic$user.another_user.second_inbound$user.topic.inbound_inbound$topic.post_from_layer_two.blog_in_topic$post",
  ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post.inbound_inbound$post_from_layer_two.topic.blog_in_topic$second_topic",
  ".users.second_inbound$user.topic.blog_in_topic$topic.post.inbound_inbound$post_from_layer_two.topic.blog_in_topic$second_topic",
];

export const expectedSix = [
  ...expectedFive,
  ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post.blog_in_topic$post",
  ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.post_from_layer_two.blog_in_topic$post",
  ".users.user_interested_in_topic$another_user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post.blog_in_topic$post",
  ".users.user_interested_in_topic$another_user.topic.inbound_level_three$topic.inbound_level_two.post_from_layer_two.blog_in_topic$post",
  ".users.second_inbound$user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post.blog_in_topic$post",
  ".users.second_inbound$user.topic.inbound_level_three$topic.inbound_level_two.post_from_layer_two.blog_in_topic$post",
];

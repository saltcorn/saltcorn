// Mobile mock for "@aws-sdk/s3-request-presigner". S3 presigning is server-only.
export const getSignedUrl = async (
  _client?: any,
  _command?: any,
  _options?: any
): Promise<string> => {
  throw new Error(
    "@aws-sdk/s3-request-presigner may not be used in a mobile enviroment"
  );
};

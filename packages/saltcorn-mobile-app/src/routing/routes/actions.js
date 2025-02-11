import { apiCall } from "../../helpers/api";

// TODO local in offline mode

export const postResumeWorkflow = async (context) => {
  console.log("postResumeWorkflow");
  console.log(context);
  const { id } = context.params;
  const response = await apiCall({
    method: "POST",
    path: `/actions/resume-workflow/${id}`,
  });
  console.log(response);
  return response.data;
};

export const getFillWorkflowForm = async (context) => {
  console.log("getFillWorkflowForm");
  console.log(context);
  const { id } = context.params;
  const response = await apiCall({
    method: "GET",
    path: `/actions/fill-workflow-form/${id}`,
  });
  console.log(response);
  return response.data;
};

export const postFillWorkflowForm = async (context) => {
  console.log("postFillWorkflowForm");
  console.log(context);
  const { id } = context.params;
  const response = await apiCall({
    method: "POST",
    path: `/actions/fill-workflow-form/${id}`,
  });
  console.log(response);
  return response.data;
};

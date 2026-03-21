export interface JiraSearchResult {
  issues?: Array<{ key?: string; id?: string } & Record<string, unknown>>;
}

export interface JiraCreateIssuePayload {
  project: string;
  issueType: string;
  summary: string;
  description: string;
  labels: string[];
}

export interface JiraCreateIssueResponse {
  key: string;
}

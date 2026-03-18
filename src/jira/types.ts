export interface JiraSearchResult {
  issues: Array<{ key: string }>;
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

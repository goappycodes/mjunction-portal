export interface ReportRow {
  company_name: string;
  unique_id: string;
  order_id: string;
  customer_name: string;
  contact: string;
  telecaller: string;
  product: string;
  attempt_number: number;
  status: string;
  language: string;
  /** The single key the caller pressed on the IVR menu: "1" confirm, "2" issue. */
  dtmf: string;
  started_at: string;
  ended_at: string;
  sealed_voc_id: string;
}

export interface Report {
  generatedAt: string;
  rows: ReportRow[];
}

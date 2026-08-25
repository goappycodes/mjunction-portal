export interface ReportRow {
  campaign: string;
  unique_id: string;
  order_id: string;
  customer_name: string;
  contact: string;
  telecaller: string;
  product: string;
  attempt_number: number;
  status: string;
  language: string;
  dtmf: string;
  started_at: string;
  ended_at: string;
  sealed_voc_id: string;
  duration: string;
}

export interface CampaignReport {
  campaignName: string;
  orderReference: string;
  generatedAt: string;
  rows: ReportRow[];
}

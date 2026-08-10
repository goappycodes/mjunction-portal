export interface ReportRow {
  campaign: string;
  recipient_id: string;
  customer_name: string;
  contact: string;
  telecaller: string;
  product: string;
  status: string;
  language: string;
  order_confirmed: string;
  dispatched: string;
  delivered: string;
  delivery_confirmed: string;
  sealed_voc_id: string;
  dtmf: string;
  duration: string;
}

export interface CampaignReport {
  campaignName: string;
  orderReference: string;
  generatedAt: string;
  rows: ReportRow[];
}

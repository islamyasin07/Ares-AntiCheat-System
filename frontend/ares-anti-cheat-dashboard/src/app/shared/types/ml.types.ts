export interface MlDetection {
  _id?: string;
  player_id: string;
  detected_at: number; // epoch ms
  cheat_probability?: number;
  risk_level?: 'low' | 'medium' | 'high' | 'critical' | string;
  confidence?: number;
  ruleTriggered?: string;
  source?: string;
  details?: any;
}

export interface MlCounts {
  total: number;
  recent: number;
  highRisk: number;
}

export interface ModelInfo {
  model_name: string;
  model_type: string;
  features_count: number;
  loaded_at: string;
  model_path?: string;
}

export interface SparkDetection {
  _id?: string;
  player_id: string;
  timestamp: number; // epoch ms
  rule: string;
  details?: any;
}

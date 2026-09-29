export interface FourWheelMetric {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

export interface TelemetryFrame {
  identifier: string;
  size: number;
  speed_kmh: number;
  speed_mph: number;
  speed_ms: number;
  is_abs_enabled: boolean;
  is_abs_in_action: boolean;
  is_tc_in_action: boolean;
  is_tc_enabled: boolean;
  is_in_pit: boolean;
  is_engine_limiter_on: boolean;
  heave: number;
  sway: number;
  surge: number;
  lap_time_ms: number;
  last_lap_ms: number;
  best_lap_ms: number;
  lap_count: number;
  throttle: number;
  brake: number;
  clutch: number;
  engine_rpm: number;
  steer: number;
  gear: number;
  gear_name: string;
  cg_height: number;
  wheel_angular_speed: FourWheelMetric;
  slip_angle: FourWheelMetric;
  slip_angle_contact_patch: FourWheelMetric;
  slip_ratio: FourWheelMetric;
  tyre_slip: FourWheelMetric;
  nd_slip: FourWheelMetric;
  vertical_load: FourWheelMetric;
  lateral_load: FourWheelMetric;
  self_aligning_torque: FourWheelMetric;
  tyre_dirty_level: FourWheelMetric;
  camber_rad: FourWheelMetric;
  tyre_radius: FourWheelMetric;
  tyre_loaded_radius: FourWheelMetric;
  suspension_height: FourWheelMetric;
  car_position_normalized: number;
  car_slope: number;
  car_coordinates: [number, number, number];
}

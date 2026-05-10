export interface BookingRequest {
  user_id: string;
  court_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  addons?: string[];
}

export interface BookingResponse {
  id: string;
  user_id: string;
  court_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  base_price?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'checked_in';
  created_at?: string;
}

export interface CoachingSessionRequest {
  coach_id: string;
  user_id: string;
  sport_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

export interface PaymentRequest {
  booking_id?: string;
  coaching_session_id?: string;
  amount: number;
  payment_method: 'gcash' | 'paymongo' | 'cash';
}

export interface AuthenticatedContext {
  userId: string;
  role: 'user' | 'staff' | 'admin';
}
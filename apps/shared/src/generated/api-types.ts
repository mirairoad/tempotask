// Generated Types from OpenAPI Schema

// Schema Types
export type User = {
    email: string;
    roles?: 'USER' | 'BUSINESS' | 'ADMIN' | 'SUPER_ADMIN'[];
    verified?: boolean;
    last_login?: string | null;
    last_ip?: string | null;
    profile?: {
        first_name?: string | null;
        last_name?: string | null;
        job_title?: string | null;
        avatar?: string | null;
        mobile?: string | null;
    };
    services?: {
        provider: 'credentials' | 'google' | 'microsoft';
        reference_id: string;
        password?: string;
        data?: Record<string, any>;
    }[] | null;
    meta?: {
        createdAt?: string;
        createdBy?: string | null;
        deletedAt?: string | null;
        deletedBy?: string | null;
        updatedAt?: string;
        updatedBy?: string | null;
    };
    _id?: any;
};

export type Notification = {
    notification_type?: 'email' | 'phone' | 'push';
    notification_template?: 'email_welcome' | 'email_verification_code' | 'email_reset_password' | 'phone_verification_code' | 'push_notification' | 'custom';
    recipient: any;
    owner_id?: string | null;
    meta?: {
        createdAt?: string;
        createdBy?: string | null;
        deletedAt?: string | null;
        deletedBy?: string | null;
        updatedAt?: string;
        updatedBy?: string | null;
    };
    _id?: any;
};


// API Endpoint Types
export interface PostSigninRequest {
  email: string;
  password: string;
}

export interface PostSigninResponse {
  email?: string;
  password?: string;
}

export interface PostSignupRequest {
  email: string;
  password: string;
  profile?: { first_name: string; last_name: string };
}

export interface PostVerifyMFARequest {
  email: string;
  password: string;
  profile?: { first_name: string; last_name: string };
}


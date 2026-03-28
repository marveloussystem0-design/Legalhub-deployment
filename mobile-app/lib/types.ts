export type UserRole = 'advocate' | 'client' | 'admin' | 'clerk';

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  isVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdvocateProfile {
  id: string;
  userId: string;
  fullName: string;
  barCouncilNumber?: string;
  barCouncilState?: string;
  enrollmentDate?: string;
  specialization: string[];
  experienceYears?: number;
  rating: number;
  totalReviews: number;
  bio?: string;
  profilePhotoUrl?: string;
  isVerified: boolean;
}

export interface ClientProfile {
  id: string;
  userId: string;
  fullName: string;
  aadhaarNumber?: string;
  panNumber?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profilePhotoUrl?: string;
  isVerified: boolean;
}

export type CaseStatus = 'open' | 'pending' | 'closed' | 'archived';
export type PartyType = 'petitioner' | 'respondent' | 'appellant' | 'accused';

export interface Case {
  id: string;
  caseNumber: string;
  filingNumber?: string;
  firNumber?: string;
  caseType: string;
  courtName: string;
  jurisdiction?: string;
  title: string;
  description?: string;
  status: CaseStatus;
  filingDate?: string;
  nextHearingDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseParticipant {
  id: string;
  caseId: string;
  userId: string;
  role: UserRole;
  partyType?: PartyType;
  addedAt: string;
}

export interface Hearing {
  id: string;
  caseId: string;
  hearingDate: string;
  courtRoom?: string;
  judgeName?: string;
  hearingType?: string;
  status: string;
  outcome?: string;
  nextHearingDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  caseId?: string;
  uploadedBy: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  documentType?: string;
  tags: string[];
  ocrText?: string;
  version: number;
  parentDocumentId?: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  caseId?: string;
  content: string;
  isEncrypted: boolean;
  isRead: boolean;
  readAt?: string;
  attachments?: any;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

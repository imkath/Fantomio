// User types
export interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

// Wishlist types
export interface WishlistItem {
  id: string
  description: string
  url?: string | null
  priority: number
}

// Participant types
export interface Participant {
  id: string
  userId: string
  hasCompletedWishlist: boolean
  user: User
  wishlistItems: WishlistItem[]
  assignedTo?: {
    id: string
    user: User
    wishlistItems: WishlistItem[]
  } | null
}

// Group types
export type GroupStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED'

export interface Group {
  id: string
  name: string
  description: string | null
  budget: number | null
  currency: string
  eventDate: string | null
  status: GroupStatus
  inviteCode: string
  ownerId: string
  owner: User
  participants: Participant[]
  _count?: {
    participants: number
  }
  createdAt: string
  updatedAt: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success?: boolean
  error?: string
  data?: T
}

export interface GroupsResponse {
  groups: Group[]
}

export interface GroupResponse {
  group: Group
  isOwner: boolean
}

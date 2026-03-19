import { Role } from '@prisma/client'
import { db } from '@/lib/db'

// Permission levels
export enum Permission {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  ADMIN = 'ADMIN',
}

// Resource types
export type ResourceType = 'patient' | 'drug' | 'prescriber' | 'prescription' | 'sale'

// Permission matrix for each role
const permissionMatrix: Record<Role, Record<ResourceType, Permission[]>> = {
  ADMIN: {
    patient: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    drug: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    prescriber: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    prescription: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    sale: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
  },
  PHARMACIST: {
    patient: [Permission.READ, Permission.WRITE],
    drug: [Permission.READ, Permission.WRITE],
    prescriber: [Permission.READ, Permission.WRITE],
    prescription: [Permission.READ, Permission.WRITE],
    sale: [Permission.READ],
  },
  TECHNICIAN: {
    patient: [Permission.READ, Permission.WRITE],
    drug: [Permission.READ],
    prescriber: [Permission.READ],
    prescription: [Permission.READ],
    sale: [Permission.READ],
  },
  CASHIER: {
    patient: [Permission.READ],
    drug: [Permission.READ],
    prescriber: [Permission.READ],
    prescription: [Permission.READ],
    sale: [Permission.READ, Permission.WRITE],
  },
}

// User type for permission checks
interface UserForPermission {
  id: string
  role: Role
}

/**
 * Check if a user has a specific permission for a resource
 */
export function hasPermission(
  user: UserForPermission,
  resource: ResourceType,
  permission: Permission
): boolean {
  const rolePermissions = permissionMatrix[user.role]?.[resource] || []
  return rolePermissions.includes(permission)
}

/**
 * Check if user can read a resource
 */
export function canRead(user: UserForPermission | null, resource: ResourceType): boolean {
  if (!user) return false
  return hasPermission(user, resource, Permission.READ)
}

/**
 * Check if user can write/create a resource
 */
export function canWrite(user: UserForPermission | null, resource: ResourceType): boolean {
  if (!user) return false
  return hasPermission(user, resource, Permission.WRITE)
}

/**
 * Check if user can delete a resource
 */
export function canDelete(user: UserForPermission | null, resource: ResourceType): boolean {
  if (!user) return false
  return hasPermission(user, resource, Permission.DELETE)
}

/**
 * Check if user is admin
 */
export function isAdmin(user: UserForPermission | null): boolean {
  if (!user) return false
  return user.role === Role.ADMIN
}

/**
 * Check if user can edit a specific record
 * User can edit if:
 * 1. They are an admin (full access), OR
 * 2. They have WRITE permission AND they created the record
 */
export async function canEdit(
  user: UserForPermission | null,
  resource: ResourceType,
  recordId: string
): Promise<boolean> {
  if (!user) return false
  
  // Admins can edit anything
  if (isAdmin(user)) return true
  
  // Check if user has write permission for this resource type
  if (!canWrite(user, resource)) return false
  
  // Check if user created the record
  try {
    let record: { createdById: string | null } | null = null
    
    switch (resource) {
      case 'patient':
        record = await db.patient.findUnique({
          where: { id: recordId },
          select: { createdById: true },
        })
        break
      case 'drug':
        record = await db.drug.findUnique({
          where: { id: recordId },
          select: { createdById: true },
        })
        break
      case 'prescriber':
        record = await db.prescriber.findUnique({
          where: { id: recordId },
          select: { createdById: true },
        })
        break
      default:
        return false
    }
    
    // If record doesn't exist, deny access
    if (!record) return false
    
    // Allow edit if user created the record
    return record.createdById === user.id
  } catch (error) {
    console.error('Error checking record ownership:', error)
    return false
  }
}

/**
 * Check if user can delete a specific record
 * Uses same logic as canEdit - admin or owner with delete permission
 */
export async function canDeleteRecord(
  user: UserForPermission | null,
  resource: ResourceType,
  recordId: string
): Promise<boolean> {
  if (!user) return false
  
  // Admins can delete anything
  if (isAdmin(user)) return true
  
  // Check if user has delete permission for this resource type
  if (!canDelete(user, resource)) return false
  
  // Check if user created the record
  try {
    let record: { createdById: string | null } | null = null
    
    switch (resource) {
      case 'patient':
        record = await db.patient.findUnique({
          where: { id: recordId },
          select: { createdById: true },
        })
        break
      case 'drug':
        record = await db.drug.findUnique({
          where: { id: recordId },
          select: { createdById: true },
        })
        break
      case 'prescriber':
        record = await db.prescriber.findUnique({
          where: { id: recordId },
          select: { createdById: true },
        })
        break
      default:
        return false
    }
    
    // If record doesn't exist, deny access
    if (!record) return false
    
    // Allow delete if user created the record
    return record.createdById === user.id
  } catch (error) {
    console.error('Error checking record ownership:', error)
    return false
  }
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(role: Role): Record<ResourceType, Permission[]> {
  return permissionMatrix[role] || permissionMatrix.TECHNICIAN
}

/**
 * Require authentication - returns user or throws error
 * For use in API routes
 */
export function requireAuth(user: UserForPermission | null): UserForPermission {
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

/**
 * Require permission - returns true or throws error
 * For use in API routes
 */
export function requirePermission(
  user: UserForPermission | null,
  resource: ResourceType,
  permission: Permission
): void {
  requireAuth(user)
  if (!hasPermission(user!, resource, permission)) {
    throw new Error(`Permission denied: ${permission} access to ${resource}`)
  }
}

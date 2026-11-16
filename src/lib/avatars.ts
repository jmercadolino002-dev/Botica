import adminAvatar from '../assets/images/avatar_pharmacist_admin_1794693509055.jpg';
import sellerAvatar from '../assets/images/avatar_pharmacy_seller_1794693509115.jpg';
import type { UserRole } from '../shared/types';

export function getStaffAvatar(role: UserRole): string {
  return role === 'admin' ? adminAvatar : sellerAvatar;
}

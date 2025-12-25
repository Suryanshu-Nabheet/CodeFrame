// TODO: Move this to a proper auth types file when authentication is fully implemented
type UserType = "guest" | "regular";

interface Entitlements {
  maxMessagesPerDay: number;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account (anonymous)
   */
  guest: {
    maxMessagesPerDay: 5,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 50,
  },
};

// For anonymous users (no session)
export const anonymousEntitlements: Entitlements = {
  maxMessagesPerDay: 3,
};

import { useMemo } from "react";

export function useIntegrityCasePermissions(permissions: string[]) {
  return useMemo(() => {
    const has = (permission: string) => permissions.includes(permission);
    const canManage = has("integrity.cases.manage");
    return {
      canManage,
      canInvestigate: canManage || has("integrity.cases.investigate"),
      canWriteNote: canManage || has("integrity.notes.create"),
      canSendMessage: canManage || has("integrity.messages.send"),
      canClose: canManage || has("integrity.cases.close"),
      canReopen: canManage || has("integrity.cases.reopen"),
      canRecommend: canManage || has("integrity.cases.recommend"),
      canReadIdentity: has("integrity.identity.read"),
    };
  }, [permissions]);
}

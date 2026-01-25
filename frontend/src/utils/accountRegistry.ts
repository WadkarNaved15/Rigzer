export type StoredAccount = {
  userId: string;
  username: string;
  avatar?: string;
};

export const getStoredAccounts = (): StoredAccount[] => {
  return JSON.parse(localStorage.getItem("accounts") || "[]");
};

export const saveAccount = (account: StoredAccount) => {
  const accounts = getStoredAccounts();

  if (!accounts.find(a => a.userId === account.userId)) {
    accounts.push(account);
    localStorage.setItem("accounts", JSON.stringify(accounts));
  }
};

export const removeAccount = (userId: string) => {
  const accounts = getStoredAccounts().filter(a => a.userId !== userId);
  localStorage.setItem("accounts", JSON.stringify(accounts));
};

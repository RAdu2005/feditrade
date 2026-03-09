import { CompleteAuthClient } from "@/app/auth/complete/complete-auth-client";

type PageProps = {
  searchParams: Promise<{
    loginToken?: string;
    callbackUrl?: string;
  }>;
};

export default async function CompleteAuthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <CompleteAuthClient
      loginToken={params.loginToken ?? null}
      callbackUrl={params.callbackUrl ?? "/"}
    />
  );
}

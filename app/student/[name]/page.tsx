import { requireRole } from "@/lib/auth/session";
import { ExamWorkspace } from "@/components/student/ExamWorkspace";

export default async function StudentExamPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const session = await requireRole("student");
  const { name } = await params;
  return (
    <ExamWorkspace examName={decodeURIComponent(name)} username={session.user.githubUsername} />
  );
}

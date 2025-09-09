import { SessionFlow } from "@/components/flow/session-flow";

export default function Home() {
  return (
    <main className="bg-gradient-to-br from-blue-300 to-purple-300 flex min-h-screen flex-col items-center justify-center p-4 font-sans">
      <SessionFlow />
    </main>
  );
}

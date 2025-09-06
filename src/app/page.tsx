import { SenderFlow } from "@/components/flow/sender-flow";
import { ReceiverFlow } from "@/components/flow/receiver-flow";

export default function Home() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Welcome to V Share</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Instantly share files and links between your devices with ease and security.
        </p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-12 lg:grid-cols-2">
        <SenderFlow />
        <ReceiverFlow />
      </div>
    </main>
  );
}
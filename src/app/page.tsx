import { SenderFlow } from "@/components/flow/sender-flow";
import { ReceiverFlow } from "@/components/flow/receiver-flow";

export default function Home() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">V Share</h1>
        <p className="text-lg text-muted-foreground">
          Share files and links directly between devices.
        </p>
      </div>
      <div className="grid w-full max-w-4xl grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <SenderFlow />
        <ReceiverFlow />
      </div>
    </main>
  );
}

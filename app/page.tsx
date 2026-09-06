import Sender from "@/components/Sender";
import Receiver from "@/components/Receiver";

export default function Home() {
  return (
    // เพิ่ม div คลุมด้านนอกเพื่อให้พื้นหลังสีชมพูอ่อน (bg-pink-50) ขยายเต็มจอ
    // และใส่ font-sans เพื่อให้ภาพรวมฟอนต์ดูมินิมอล
    <div className="min-h-screen w-full bg-pink-50 font-sans">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center px-5 py-10 sm:justify-center sm:py-12">
        <header className="flex flex-col items-center text-center">
          {/* ปรับจาก font-bold เป็น font-medium และใช้ tracking-tight เพื่อความเรียบหรู */}
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            sendtoher
          </h1>
          {/* ปรับฟอนต์ให้บางลงด้วย font-light */}
          <p className="mt-2 text-sm font-light text-muted">S</p>
        </header>

        <div className="mt-9 grid w-full grid-cols-1 gap-4 sm:mt-10 md:grid-cols-2">
          <Sender />
          <Receiver />
        </div>
      </main>
    </div>
  );
}
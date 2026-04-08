import { Loader } from "@/components/Loader";

export default function Loading() {
  return (
    <div className="min-h-[660px] flex align-center justify-center">
      <div className="loaderbody">
        <Loader />
      </div>
    </div>
  );
}

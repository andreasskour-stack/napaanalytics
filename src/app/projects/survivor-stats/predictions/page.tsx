import PageHeader from "@/app/projects/survivor-stats/components/PageHeader";

export default function PredictionsPage() {
  return (
    <>
      <PageHeader
        title="Predictions"
        subtitle="This will be the premium page: win odds + elimination risk."
      />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-gray-300">
        Next: probability bars + confidence indicators.
      </div>
    </>
  );
}

export default function PageHeader(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>  
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="mt-2 text-sm text-gray-300">{props.subtitle}</p>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

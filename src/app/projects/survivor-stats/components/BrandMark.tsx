import Link from "next/link";
import Image from "next/image";

export default function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/brand/napa-logo-icon.svg"
        alt="Napa Analytics"
        width={28}
        height={28}
        priority
      />
      <Image
        src="/brand/napa-logo-inverted.svg"
        alt="Napa Analytics"
        width={170}
        height={34}
        priority
      />
    </Link>
  );
}

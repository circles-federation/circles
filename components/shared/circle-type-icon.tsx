import type { ComponentType, SVGProps } from "react";
import { BuildingOffice2Icon, BuildingStorefrontIcon, LockClosedIcon, MapPinIcon, Squares2X2Icon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { Circle, CircleType } from "@/lib/types";
import { RingIcon } from "./ring-icon";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// each kind's icon: a ring for a Circle, as on every chip; a pin for a
// neighborhood, a place
export const CIRCLE_TYPE_ICON: Record<CircleType, Icon> = {
  neighborhood: MapPinIcon,
  circle: RingIcon,
  collective: UserGroupIcon,
  cooperative: BuildingStorefrontIcon,
  group: LockClosedIcon,
  other: Squares2X2Icon,
};

// a circle's icon, the city (the root, whatever its type) its own
export function CircleTypeIcon({ circle, ...props }: { circle: Pick<Circle, "type" | "parentId"> } & SVGProps<SVGSVGElement>) {
  return circle.parentId === null ? <BuildingOffice2Icon {...props} /> : <TypeIcon {...props} kind={circle.type} />;
}

function TypeIcon({ kind, ...props }: { kind: CircleType } & SVGProps<SVGSVGElement>) {
  const Icon = CIRCLE_TYPE_ICON[kind];
  return <Icon {...props} />;
}

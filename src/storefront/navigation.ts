/**
 * Nomaan Brothers V2 taxonomy.
 * Customer-approved garment labels use Tobh, Jooti and Sadiri.
 * Existing internal URL paths are retained to avoid breaking old links.
 */
export type DepartmentId = 'men' | 'kids';

export interface CollectionEntry {
  label: string;
  path: string;
  intro?: string;
}

export interface CollectionGroup {
  title: string;
  landingPath?: string;
  items: CollectionEntry[];
}

export interface Department {
  id: DepartmentId;
  title: string;
  path: string;
  description: string;
  groups: CollectionGroup[];
}

export const DEPARTMENTS: Department[] = [
  {
    id: 'men',
    title: "Men's Wear",
    path: '/men',
    description: 'Traditional menswear, occasion styling and wedding collections.',
    groups: [
      { title: 'Traditional Wear', items: [
        { label: 'Kurta Pyjama', path: '/men/kurta-pyjama' },
        { label: 'Pathani', path: '/men/pathani' },
        { label: 'Jodhpuri', path: '/men/jodhpuri' },
        { label: 'Tobh', path: '/men/tope' },
      ] },
      { title: 'Sherwani', landingPath: '/men/sherwani', items: [
        { label: 'Handwork Sherwani', path: '/men/sherwani/handwork' },
        { label: 'Plain Sherwani', path: '/men/sherwani/plain' },
      ] },
      { title: 'Suits', landingPath: '/men/suits', items: [
        { label: 'Handwork Suits', path: '/men/suits/handwork' },
        { label: 'Plain Suits', path: '/men/suits/plain' },
      ] },
      { title: 'Marriage Collection', landingPath: '/men/marriage', items: [
        { label: 'Jooti', path: '/men/marriage/jutti' },
        { label: 'Pagdi', path: '/men/marriage/pagdi' },
        { label: 'Sadiri', path: '/men/marriage/sadi' },
      ] },
    ],
  },
  {
    id: 'kids',
    title: 'Kids Wear',
    path: '/kids',
    description: 'Occasionwear and traditional styles for the next generation.',
    groups: [
      { title: 'Kids Collections', items: [
        { label: 'Kurta Pyjama', path: '/kids/kurta-pyjama' },
        { label: 'Sherwani', path: '/kids/sherwani' },
        { label: 'Pathani', path: '/kids/pathani' },
        { label: 'Sadiri', path: '/kids/sadi' },
        { label: 'Suits', path: '/kids/suits' },
        { label: 'Jodhpuri', path: '/kids/jodhpuri' },
        { label: 'Tobh', path: '/kids/tope' },
      ] },
    ],
  },
];

export const normalizePath = (raw: string): string => {
  const path = raw.split('?')[0].replace(/\/+$/, '') || '/';
  return path.startsWith('/') ? path : '/' + path;
};

export interface CollectionRoute {
  title: string;
  path: string;
  department: DepartmentId;
  isDepartment: boolean;
  isGroup: boolean;
  description: string;
}

const collections = DEPARTMENTS.flatMap((department): CollectionRoute[] => [
  { title: department.title, path: department.path, department: department.id,
    isDepartment: true, isGroup: false, description: department.description },
  ...department.groups.flatMap((group): CollectionRoute[] => [
    ...(group.landingPath ? [{
      title: group.title, path: group.landingPath, department: department.id,
      isDepartment: false, isGroup: true,
      description: group.title + ' from Nomaan Brothers.',
    }] : []),
    ...group.items.map((item) => ({
      title: item.label, path: item.path, department: department.id,
      isDepartment: false, isGroup: false,
      description: item.intro || item.label + ' from Nomaan Brothers.',
    })),
  ]),
]);

export const COLLECTION_ROUTES: CollectionRoute[] = collections.filter(
  (route, index, list) => list.findIndex((other) => other.path === route.path) === index
);
export const getCollection = (path: string): CollectionRoute | undefined =>
  COLLECTION_ROUTES.find((route) => route.path === normalizePath(path));

export const getDepartment = (id: DepartmentId): Department =>
  DEPARTMENTS.find((department) => department.id === id)!;

export const isCollectionPath = (path: string) => Boolean(getCollection(path));

export const getRelatedCollectionLinks = (path: string): CollectionEntry[] => {
  const route = getCollection(path);
  if (!route) return [];
  const department = getDepartment(route.department);
  if (route.isDepartment) return department.groups.flatMap((group) => group.items);
  const group = department.groups.find((entry) =>
    entry.landingPath === route.path || entry.items.some((item) => item.path === route.path)
  );
  return group ? group.items : [];
};

// Shared class list — edit here to update the entire app
// Get the school type terminology
export const getSchoolName = (church) => {
  return church?.denomination === 'Other' ? 'Sunday School' : 'Sabbath School';
};

// Generate dynamic class list
export const getClassesForChurch = (church) => {
  const prefix = getSchoolName(church);
  return [
    `${prefix} Class 1`,
    `${prefix} Class 2`,
    `${prefix} Class 3`,
    `${prefix} Class 4`,
    `${prefix} Class 5`,
    `${prefix} Class 6`
  ];
};

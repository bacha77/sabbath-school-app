// Shared class list — edit here to update the entire app
// Get the school type terminology
export const getSchoolName = (church) => {
  return church?.denomination === 'Other' ? 'Sunday School' : 'Sabbath School';
};

// Generate dynamic class list
export const getClassesForChurch = (church) => {
  // If the church has a custom list of classes, return it
  if (church?.classes && Array.isArray(church.classes) && church.classes.length > 0) {
    return church.classes;
  }
  
  // Local storage fallback for placeholder/demo mode
  if (typeof window !== 'undefined' && church?.id) {
    try {
      const localClasses = localStorage.getItem(`classes_${church.id}`);
      if (localClasses) {
        const parsed = JSON.parse(localClasses);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

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

export const getId = (record) => String(record?._id || record?.id || "");

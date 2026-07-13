export interface NextClientEntry {
  checkInDate: string;
  updatedAt: string | null;
}

export interface NextClientEntryInput {
  propertyId: string;
  taskDate: string;
}

export type NextClientEntryReader = (input: {
  propertyId: string;
  fromDate: string;
}) => Promise<NextClientEntry | null>;

export const canViewNextClientEntry = (role: string | null | undefined): boolean => role === 'admin';

export const formatNextClientEntryLabel = (checkInDate: string, taskDate: string): string => {
  if (checkInDate === taskDate) return 'Hoy';

  const [year, month, day] = checkInDate.split('-');
  if (!year || !month || !day) return checkInDate;
  return `${day}/${month}/${year}`;
};

export const loadNextClientEntry = async (
  input: NextClientEntryInput,
  reader: NextClientEntryReader,
): Promise<NextClientEntry | null> => {
  if (!input.propertyId) throw new Error('propertyId is required');
  if (!input.taskDate) throw new Error('taskDate is required');

  return reader({ propertyId: input.propertyId, fromDate: input.taskDate });
};

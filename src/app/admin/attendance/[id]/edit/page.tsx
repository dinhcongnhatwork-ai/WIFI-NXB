'use client';
import { useParams } from 'next/navigation';
import { AttendanceSessionForm } from '@/components/attendance/AttendanceSessionForm';
export default function EditAttendanceSessionPage() {
  const { id } = useParams<{ id: string }>();
  return <AttendanceSessionForm sessionId={id} />;
}

/** A missing or failed observation cannot establish an incident-free system. */
export function eventDataState(response: any): { available: boolean; label: string } {
  const available = response?.success === true && response?.data != null;
  return {
    available,
    label: available ? "Theo bộ lọc hiện tại" : response?.error || (response ? "Chưa có dữ liệu sự cố" : "Đang tải dữ liệu sự cố"),
  };
}

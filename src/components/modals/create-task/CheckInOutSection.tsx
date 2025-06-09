
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CheckInOutSectionProps {
  formData: {
    checkOut: string;
    checkIn: string;
  };
}

export const CheckInOutSection = ({ formData }: CheckInOutSectionProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="checkOut">Check-out (auto)</Label>
        <Input
          id="checkOut"
          type="time"
          value={formData.checkOut}
          readOnly
          className="bg-gray-50"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="checkIn">Check-in (auto)</Label>
        <Input
          id="checkIn"
          type="time"
          value={formData.checkIn}
          readOnly
          className="bg-gray-50"
        />
      </div>
    </div>
  );
};

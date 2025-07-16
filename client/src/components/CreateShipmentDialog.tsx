import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { insertShipmentSchema } from "@shared/schema";
import { z } from "zod";
import { Plus, Ship, Plane, Truck } from "lucide-react";

const shipmentFormSchema = insertShipmentSchema.extend({
  shipmentId: z.string().min(1, "Shipment ID is required"),
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  transportMode: z.string().min(1, "Transport mode is required"),
});

type ShipmentFormData = z.infer<typeof shipmentFormSchema>;

interface CreateShipmentDialogProps {
  trigger?: React.ReactNode;
}

export default function CreateShipmentDialog({ trigger }: CreateShipmentDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      shipmentId: "",
      origin: "",
      destination: "",
      transportMode: "ocean",
      status: "pending",
    },
  });

  const createShipmentMutation = useMutation({
    mutationFn: async (data: ShipmentFormData) => {
      const response = await apiRequest("POST", "/api/shipments", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Shipment created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      reset();
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ShipmentFormData) => {
    createShipmentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-freight-orange hover:bg-freight-orange/90 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Shipment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Shipment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipmentId">Shipment ID *</Label>
              <Input
                id="shipmentId"
                {...register("shipmentId")}
                placeholder="e.g., SH-2025-001"
              />
              {errors.shipmentId && (
                <p className="text-sm text-red-600">{errors.shipmentId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transportMode">Transport Mode *</Label>
              <Select value={watch("transportMode")} onValueChange={(value) => setValue("transportMode", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transport mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">
                    <div className="flex items-center space-x-2">
                      <Plane className="w-4 h-4" />
                      <span>Air Freight</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ocean">
                    <div className="flex items-center space-x-2">
                      <Ship className="w-4 h-4" />
                      <span>Ocean Freight</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="trucking">
                    <div className="flex items-center space-x-2">
                      <Truck className="w-4 h-4" />
                      <span>Trucking</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="last_mile">
                    <div className="flex items-center space-x-2">
                      <Truck className="w-4 h-4 text-green-600" />
                      <span>Last Mile</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.transportMode && (
                <p className="text-sm text-red-600">{errors.transportMode.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={watch("status")} onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="totalValue">Total Value ($)</Label>
              <Input
                id="totalValue"
                type="number"
                step="0.01"
                {...register("totalValue")}
                placeholder="e.g., 50000.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Origin *</Label>
              <Input
                id="origin"
                {...register("origin")}
                placeholder="e.g., Shanghai, China"
              />
              {errors.origin && (
                <p className="text-sm text-red-600">{errors.origin.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="originPort">Origin Port</Label>
              <Input
                id="originPort"
                {...register("originPort")}
                placeholder="e.g., CNSHA"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Destination *</Label>
              <Input
                id="destination"
                {...register("destination")}
                placeholder="e.g., Los Angeles, USA"
              />
              {errors.destination && (
                <p className="text-sm text-red-600">{errors.destination.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinationPort">Destination Port</Label>
              <Input
                id="destinationPort"
                {...register("destinationPort")}
                placeholder="e.g., USLAX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vessel">Vessel</Label>
              <Input
                id="vessel"
                {...register("vessel")}
                placeholder="e.g., MSC OSCAR"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="containerNumber">Container Number</Label>
              <Input
                id="containerNumber"
                {...register("containerNumber")}
                placeholder="e.g., MSKU1234567"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billOfLading">Bill of Lading</Label>
              <Input
                id="billOfLading"
                {...register("billOfLading")}
                placeholder="e.g., MSC123456789"
              />
            </div>

            <div></div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createShipmentMutation.isPending}
              className="bg-freight-blue hover:bg-freight-blue/90 text-white"
            >
              {createShipmentMutation.isPending ? "Creating..." : "Create Shipment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
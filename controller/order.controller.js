import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";

const ORDER_STATUS_SYSTEM_TO_LABEL = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function normalizeObjectId(v) {
  return v?.toString ? v.toString() : String(v);
}

function parseIntSafe(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function buildOrderSort(sortBy) {
  // sortBy: 'createdAt' | 'orderDate' etc.
  switch (String(sortBy || "").toLowerCase()) {
    case "amount":
      return { "orderDetails.total": -1, createdAt: -1 };
    case "status":
      return { orderStatusSystem: 1, createdAt: -1 };
    case "orderdate":
    case "placedat":
      return { "orderDetails.placedAt": -1, createdAt: -1 };
    case "id":
      return { orderId: -1 };
    case "createdat":
    default:
      return { createdAt: -1 };
  }
}

async function getOrders(req, res, next) {
  try {
    const {
      q,
      status,
      page,
      limit,
      sortBy,
    } = req.query || {};

    const pageNum = Math.max(1, parseIntSafe(page, 1));
    const limNum = Math.min(100, Math.max(1, parseIntSafe(limit, 10)));
    const skip = (pageNum - 1) * limNum;

    const match = {};

    // filter by order status system OR label
    if (status) {
      const s = String(status).trim().toLowerCase();
      const normalized =
        s === "pending"
          ? "pending"
          : s === "processing"
            ? "processing"
            : s === "shipped"
              ? "shipped"
              : s === "delivered"
                ? "delivered"
                : s === "cancelled" || s === "canceled"
                  ? "cancelled"
                  : null;

      if (!normalized) {
        return res.status(400).json({ message: "Invalid status filter" });
      }

      match.orderStatusSystem = normalized;
    }

    // search by customer name/email
    if (q && String(q).trim()) {
      const term = String(q).trim();
      match.$or = [
        { "shipping.fullName": { $regex: term, $options: "i" } },
        { "shipping.email": { $regex: term, $options: "i" } },
      ];
    }

    // List endpoint should be lightweight: exclude orderDetails.items from payload.
    // Full order (including items) remains available via GET /api/v1/orders/:id.
    const listProjection = {
      _id: 1,
      orderId: 1,
      amount: 1,
      currency: 1,
      orderStatusSystem: 1,
      orderStatus: 1,
      paymentStatus: 1,
      "shipping.fullName": 1,
      "shipping.email": 1,
      "shipping.phone": 1,
      "shipping.address1": 1,
      "shipping.city": 1,
      "shipping.country": 1,
      "orderDetails.total": 1,
      "orderDetails.placedAt": 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [totalCount, orders] = await Promise.all([
      OrderModel.countDocuments(match),
      OrderModel.find(match)
        .sort(buildOrderSort(sortBy))
        .skip(skip)
        .limit(limNum)
        .select(listProjection)
        .lean(),
    ]);


    return res.status(200).json({
      message: "Orders fetched successfully",
      data: {
        orders,
        page: pageNum,
        limit: limNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await OrderModel.findById(id).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.status(200).json({ message: "Order fetched", data: order });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    if (!status || !String(status).trim()) {
      return res.status(400).json({ message: "status is required" });
    }

    // Normalize input to system + label
    const s = String(status).trim().toLowerCase();
    let system;

    if (s === "pending") system = "pending";
    else if (s === "processing") system = "processing";
    else if (s === "shipped") system = "shipped";
    else if (s === "delivered") system = "delivered";
    else if (s === "cancelled" || s === "canceled") system = "cancelled";
    else {
      return res.status(400).json({ message: "Invalid status" });
    }

    const label = ORDER_STATUS_SYSTEM_TO_LABEL[system];

    const updated = await OrderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          orderStatusSystem: system,
          orderStatus: label,
        },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Order not found" });

    return res.status(200).json({ message: "Order status updated", data: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const deleted = await OrderModel.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ message: "Order not found" });

    return res.status(200).json({ message: "Order deleted", data: deleted });
  } catch (err) {
    next(err);
  }
}

export { getOrders, getOrderById, updateOrderStatus, deleteOrder };


const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Products");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Utility function to fetch cart by userId or guestId
const getCart = async (userId, guestId) => {
  if (userId) {
    return await Cart.findOne({ user: userId });
  } else if (guestId) {
    return await Cart.findOne({ guestId });
  }
  return null;
};

// Route for POST /api/cart
router.post("/", async (req, res) => {
  let { productId, quantity, size, color, guestId, userId } = req.body;

  try {
    quantity = Number(quantity);

    
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    
    let cart = await getCart(userId, guestId);

    
    if (cart) {
      const productIndex = cart.products.findIndex(
        (p) =>
          p.productId.toString() === productId &&
          p.size === size &&
          p.color === color
      );

      if (productIndex > -1) {
        // Product already exists → update quantity
        cart.products[productIndex].quantity += quantity;
      } else {
        // Add new product
        cart.products.push({
          productId,
          name: product.name,
          image: product.images[0].url,
          price: product.price,
          size,
          color,
          quantity,
        });
      }

      // Recalculate total price
      cart.totalPrice = cart.products.reduce(
        (prev, item) => prev + item.price * item.quantity,
        0
      );

      const updatedCart = await cart.save();
      return res.status(200).json(updatedCart);
    } else {
      // Create new cart for guest or user
      const newCart = await Cart.create({
        user: userId ? userId : undefined,  
        guestId: guestId ? guestId : `guest_${Date.now()}`, 
        products: [
          {
            productId,
            name: product.name,
            image: product.images[0].url,
            price: product.price,
            size,
            color,
            quantity,
          },
        ],
        totalPrice: product.price * quantity,
      });

      return res.status(201).json(newCart);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

//Route for PUT /api/cart
// Route for PUT /api/cart
router.put("/", async (req, res) => {
  const { productId, quantity, size, color, guestId, userId } = req.body;
  try {
    let cart = await getCart(userId, guestId);
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const productIndex = cart.products.findIndex(
      (p) =>
        p.productId.toString() === productId &&
        p.size === size &&
        p.color === color
    );

    if (productIndex > -1) {
      if (quantity > 0) {
        cart.products[productIndex].quantity = quantity;
      } else {
        cart.products.splice(productIndex, 1); // remove product
      }

      cart.totalPrice = cart.products.reduce(
        (prev, item) => prev + item.price * item.quantity,
        0
      );

      const updatedCart = await cart.save();
      return res.status(200).json(updatedCart);
    } else {
      return res.status(404).json({ message: "Product not found in cart" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

//Route for DELETE /api/cart
router.delete("/", async (req, res) => {
  const { productId, size, color, guestId, userId } = req.body;
  try {
    let cart = await getCart(userId, guestId);
    if (!cart) return res.status(404).json({ message: "cart not found" });

    const productIndex = cart.products.findIndex(
      (p) =>
        p.productId.toString() === productId &&
        p.size === size &&
        p.color === color
    );

    if (productIndex > -1) {
      cart.products.splice(productIndex, 1);
      cart.totalPrice = cart.products.reduce(
        (prev, item) => prev + item.price * item.quantity,
        0
      );
      await cart.save();
      return res.status(200).json(cart);
    } else {
      return res.status(404).json({ message: "Product not found in cart" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error" });
  }
});

//Route for GET /api/cart
router.get("/", async (req, res) => {
  const { userId, guestId } = req.query;
  try {
    const cart = await getCart(userId, guestId);
    if (cart) {
      res.json(cart);
    } else {
      res.status(404).json({ message: "Cart not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

//Route POST /api/cart/merge
router.post("/merge", protect, async (req, res) => {
  const { guestId } = req.body;

  try {
    const guestCart = await Cart.findOne({ guestId });
    const userCart = await Cart.findOne({ user: req.user._id });

    if (!guestCart) {
      // No guest cart found
      if (userCart) {
        return res.status(200).json(userCart);
      }
      return res.status(404).json({ message: "Guest cart not found" });
    }

    // If guest cart exists but is empty
    if (!guestCart.products || guestCart.products.length === 0) {
      return res.status(400).json({ message: "Guest cart is empty" });
    }

    // If user already has a cart → merge both
    if (userCart) {
      guestCart.products.forEach((guestItem) => {
        const productIndex = userCart.products.findIndex(
          (item) =>
            item.productId.toString() === guestItem.productId.toString() &&
            item.size === guestItem.size &&
            item.color === guestItem.color
        );

        if (productIndex > -1) {
          // If same product already exists, increase quantity
          userCart.products[productIndex].quantity += guestItem.quantity;
        } else {
          // Otherwise push as new product
          userCart.products.push(guestItem);
        }
      });

      // Recalculate total price
      userCart.totalPrice = (userCart.products || []).reduce(
        (prev, item) => prev + item.price * item.quantity,
        0
      );

      await userCart.save();

      // Remove guest cart
      await Cart.findOneAndDelete({ guestId });

      return res.status(200).json(userCart);
    } else {
      // If user has no existing cart → assign guest cart to them
      guestCart.user = req.user._id;
      guestCart.guestId = undefined;
      await guestCart.save();

      return res.status(200).json(guestCart);
    }
  } catch (error) {
    console.error("Error merging carts:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;

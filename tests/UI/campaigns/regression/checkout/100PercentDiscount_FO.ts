// Import utils
import testContext from '@utils/testContext';

// Import commonTests
import loginCommon from '@commonTests/BO/loginBO';

// Import BO pages
import cartRulesPage from '@pages/BO/catalog/discounts';
import addCartRulePage from '@pages/BO/catalog/discounts/add';
import orderSettingsPage from '@pages/BO/shopParameters/orderSettings';
// Import FO pages
import {cartPage} from '@pages/FO/classic/cart';
import {checkoutPage} from '@pages/FO/classic/checkout';
import {orderConfirmationPage} from '@pages/FO/classic/checkout/orderConfirmation';
import {homePage} from '@pages/FO/classic/home';
import {blockCartModal} from '@pages/FO/classic/modal/blockCart';

import {
  boDashboardPage,
  FakerAddress,
  FakerCartRule,
  FakerCustomer,
  foClassicModalQuickViewPage,
  utilsPlaywright,
} from '@prestashop-core/ui-testing';

import {expect} from 'chai';
import type {BrowserContext, Page} from 'playwright';

const baseContext: string = 'regression_checkout_100PercentDiscount_FO';

/**
 * https://github.com/PrestaShop/PrestaShop/issues/9927
 *
 * If order has 100% discount and free shipping AND shop does not ask for
 * terms and conditions => checkout button will stay disabled even tho it should
 * not be disabled
 *
 * login to BO
 * add new discount (-100% free shipping)
 * Change terms and conditions setting
 */
describe('Regression - Checkout: Create 100% discount with free shipping discount code', async () => {
  let browserContext: BrowserContext;
  let page: Page;

  const percentCartRule: FakerCartRule = new FakerCartRule({
    name: 'discount100',
    code: 'discount100',
    discountType: 'Percent',
    discountPercent: 100,
    freeShipping: true,
  });
  const customerData: FakerCustomer = new FakerCustomer({password: ''});
  const addressData: FakerAddress = new FakerAddress({country: 'France'});

  // before and after functions
  before(async function () {
    browserContext = await utilsPlaywright.createBrowserContext(this.browser);
    page = await utilsPlaywright.newTab(browserContext);
  });

  after(async () => {
    await utilsPlaywright.closeBrowserContext(browserContext);
  });

  it('should login in BO', async function () {
    await loginCommon.loginBO(this, page);
  });

  /**
   * Setup, create new 100% discount code with free shipping
   */
  describe('SETUP', async () => {
    it('should go to cart rule page', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'goToCartRulesPageToCreate', baseContext);

      await boDashboardPage.goToSubMenu(
        page,
        boDashboardPage.catalogParentLink,
        boDashboardPage.discountsLink,
      );

      const pageTitle = await cartRulesPage.getPageTitle(page);
      expect(pageTitle).to.contains(cartRulesPage.pageTitle);
    });

    describe('Create a percentage cart rule', async () => {
      it('should go to new cart rule page', async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'goToNewCartRulePage1', baseContext);

        await cartRulesPage.goToAddNewCartRulesPage(page);

        const pageTitle = await addCartRulePage.getPageTitle(page);
        expect(pageTitle).to.contains(addCartRulePage.pageTitle);
      });

      it('should create new cart rule', async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'createPercentCartRule', baseContext);

        const validationMessage = await addCartRulePage.createEditCartRules(page, percentCartRule);
        expect(validationMessage).to.contains(addCartRulePage.successfulCreationMessage);
      });
    });

    describe('Change terms and conditions setting no', async () => {
      it("should go to 'Shop Parameters > Order Settings' page", async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'goToOrderSettingsPage', baseContext);

        await boDashboardPage.goToSubMenu(
          page,
          boDashboardPage.shopParametersParentLink,
          boDashboardPage.orderSettingsLink,
        );

        const pageTitle = await orderSettingsPage.getPageTitle(page);
        expect(pageTitle).to.contains(orderSettingsPage.pageTitle);
      });

      it('should change the terms and conditions back to disabled', async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'disableTermAndConditions', baseContext);

        const result = await orderSettingsPage.setTermsOfService(page, false);
        expect(result).to.contains(orderSettingsPage.successfulUpdateMessage);
      });
    });
  });

  /**
   * Test case
   * go through the checkout with out discount code and check the complete order button state
   */
  describe('Place an order with discounts in FO', async () => {
    it('should go to FO page', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'viewMyShop', baseContext);

      page = await cartRulesPage.viewMyShop(page);

      const isHomePage = await homePage.isHomePage(page);
      expect(isHomePage, 'Fail to open FO home page').to.eq(true);
    });

    it('should quick view the first product', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'quickViewTheFirstProduct', baseContext);

      await homePage.quickViewProduct(page, 1);

      const isQuickViewModalVisible = await foClassicModalQuickViewPage.isQuickViewProductModalVisible(page);
      expect(isQuickViewModalVisible).to.equal(true);
    });

    it('should add product to cart and Proceed to checkout', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'addProductToCart', baseContext);

      await foClassicModalQuickViewPage.addToCartByQuickView(page);
      await blockCartModal.proceedToCheckout(page);

      const pageTitle = await cartPage.getPageTitle(page);
      expect(pageTitle).to.equal(cartPage.pageTitle);
    });

    it('should add our discount code and check that the total price is 0', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'addPercentDiscount', baseContext);

      await cartPage.addPromoCode(page, percentCartRule.code);

      const totalPrice = await cartPage.getATIPrice(page);
      expect(totalPrice, 'Order total price is incorrect').to.equal(0);
    });

    it('should go to checkout process', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'proceedToCheckout', baseContext);

      await cartPage.clickOnProceedToCheckout(page);

      const isCheckoutPage = await checkoutPage.isCheckoutPage(page);
      expect(isCheckoutPage).to.eq(true);
    });

    it('should fill personal information as a guest', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'setPersonalInformation', baseContext);

      const isStepPersonalInfoCompleted = await checkoutPage.setGuestPersonalInformation(page, customerData);
      expect(isStepPersonalInfoCompleted, 'Step personal information is not completed').to.eq(true);
    });

    it('should fill address form and go to delivery step', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'setAddressStep', baseContext);

      const isStepAddressComplete = await checkoutPage.setAddress(page, addressData);
      expect(isStepAddressComplete, 'Step Address is not complete').to.eq(true);
    });

    it('should go to last step', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'goToLastStep', baseContext);

      // Delivery step - Go to payment step
      const isStepDeliveryComplete = await checkoutPage.goToPaymentStep(page);
      expect(isStepDeliveryComplete, 'Step Address is not complete').to.eq(true);
    });

    it('should contain no payment needed text', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'checkNoPaymentNeededText', baseContext);

      const noPaymentNeededText = await checkoutPage.getNoPaymentNeededBlockContent(page);
      expect(noPaymentNeededText).to.contains(checkoutPage.noPaymentNeededText);
    });

    it('should check that complete order button is enabled', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'checkCompleteIsNotDisabled', baseContext);

      const confirmButtonVisible = await checkoutPage.isPaymentConfirmationButtonVisibleAndEnabled(page);
      expect(confirmButtonVisible, 'Confirm button visible').to.eq(true);
    });

    it('should complete the order', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'completeOrder', baseContext);

      // complete the order
      await checkoutPage.orderWithoutPaymentMethod(page);

      // Check that we got to order confirmation (probably not necessary)
      const cardTitle = await orderConfirmationPage.getOrderConfirmationCardTitle(page);
      expect(cardTitle).to.contains(orderConfirmationPage.orderConfirmationCardTitle);
    });
  });

  /**
   * Cleanup
   * Remove the discount code and the generated order
   * Change the terms and conditions setting back to enabled
   */
  describe('CLEANUP', async () => {
    it('should go back to BO', async function () {
      await testContext.addContextItem(this, 'testIdentifier', 'BackToBOForCleanup', baseContext);

      page = await checkoutPage.closePage(browserContext, page, 0);

      const pageTitle = await orderSettingsPage.getPageTitle(page);
      expect(pageTitle).to.contains(orderSettingsPage.pageTitle);
    });

    describe('Delete created cart rules', async () => {
      it('should go to cart rules page', async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'goToCartRulesPageToDelete', baseContext);

        await cartRulesPage.goToSubMenu(
          page,
          cartRulesPage.catalogParentLink,
          cartRulesPage.discountsLink,
        );

        const pageTitle = await cartRulesPage.getPageTitle(page);
        expect(pageTitle).to.contains(cartRulesPage.pageTitle);
      });

      it('should delete our 100% cart rules', async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'deleteCartRules', baseContext);

        const validationMessage = await cartRulesPage.deleteCartRule(page);
        expect(validationMessage).to.contains(
          cartRulesPage.successfulDeleteMessage,
        );
      });
    });

    describe('Change terms and conditions setting back to yes', async () => {
      it("should go to 'Shop Parameters > Order Settings' page", async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'goToOrderSettingsPageToReset', baseContext);

        await boDashboardPage.goToSubMenu(
          page,
          boDashboardPage.shopParametersParentLink,
          boDashboardPage.orderSettingsLink,
        );

        const pageTitle = await orderSettingsPage.getPageTitle(page);
        expect(pageTitle).to.contains(orderSettingsPage.pageTitle);
      });

      it('should change the terms and conditions back to enabled', async function () {
        await testContext.addContextItem(this, 'testIdentifier', 'resetTermsAndConditionsValue', baseContext);

        const result = await orderSettingsPage.setTermsOfService(page, true, 'Terms and conditions of use');
        expect(result).to.contains(orderSettingsPage.successfulUpdateMessage);
      });
    });
  });
});

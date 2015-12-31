var expect = chai.expect;

var itemHtml = '<div class="oitm"><div class="name"><b>AWP | Lightning Strike (Factory New)</b><br><i> Covert</i><br><a onclick="previewItem($(this))">Preview</a> | <a href="http://steamcommunity.com/market/listings/730/AWP | Lightning Strike (Factory New)" target="_blank">Market</a> | <a href="/result?&amp;rdef_index[]=33&amp;rquality[]=0">Search</a></div><div class="item"><img class="smallimg" src="https://steamcommunity-a.akamaihd.net/economy/image/pMf_VkmOZmA-BExzZnSugxyLNecN_mgg6sqfaYKS5iRtzMitEJIgcp7dUI1AFPINBIxuoAThaCTswZh7g4TxLmKO3KcBlid7jqxUh0Ne4RwAmiW4QLQmPeDAqWnbkc0gYf7UqwCfJnmTnVS9TEzjIhiWJv9D_yUou5zGOZyF9nY5wIqjBZVkcsrEUdIcX_ZKTMckp1K0cC--y8RqldS8MWLG/99fx66f" alt="AWP | Lightning Strike (Factory New)" onerror="this.onerror=null;this.src=\'https://steamcommunity-a.akamaihd.net/economy/image/pMf_VkmOZmA-BExzZnSugxyLNecN_mgg6sqfaYKS5iRtzMitEJIgcp7dUI1AFPINBIxuoAThaCTswZh7g4TxLmKO3KcBlid7jqxUh0Ne4RwAmiW4QLQmPeDAqWnbkc0gYf7UqwCfJnmTnVS9TEzjIhiWJv9D_yUou5zGOZyF9nY5wIqjBZVkcsrEUdIcX_ZKTMckp1K0cC--y8RqldS8MWLG/99fx65f\';"><div class="rarity Covert">Factory New                    </div><input type="hidden" name="rdef_index[]" value="33"><input type="hidden" name="rquality[]" value="0"></div></div>';

describe('Items', function() {

    beforeEach(function() {
        window.LoungeUser = new User();
        LoungeUser.userSettings = LoungeUser.defaultSettings;
        window.blacklistedItemList = {};
        window.currencies = {"USDAUD":1.2951,"USDBRL":3.1271,"USDCAD":1.2415,"USDEUR":0.9201,"USDGBP":0.6693,"USDIDR":12958,"USDJPY":119.734,"USDKRW":1089.995,"USDMXN":14.8588,"USDMYR":3.6223,"USDNOK":7.9882,"USDNZD":1.3173,"USDPHP":44.4895,"USDRUB":53.6185,"USDSGD":1.3542,"USDTHB":32.5365,"USDTRY":2.5879,"USDUAH":23.525,"USDUSD":1,"USDVND":21605};
        window.appID = '730';
        window.marketedItems = {};
    });

    describe('constructor', function() {

        it('should set Items.item, Items.itemName, Items.weaponQuality and Items.weaponQualityAbbrevation', function() {
            var item = new Item($(itemHtml));
            expect(item).to.have.property('item');
            expect(item).to.have.property('itemName');
            expect(item).to.have.property('weaponQuality');
            expect(item).to.have.property('weaponQualityAbbrevation');
        });
    });

    describe('getMarketPrice', function() {
        it('should not get market price because it is black-listed', function() {
            var item = new Item($(itemHtml));

            blacklistedItemList = {'AWP | Lightning Strike (Factory New)': true};

            LoungeUser.userSettings.useCachedPriceList = '0';

            item.getMarketPrice();
            expect(item).to.not.have.property('marketValue');
            expect(item).to.not.have.property('marketPriced');
        });

        it('should get market price from cached price list and set item.marketPriced and item.marketValue properties', function() {
            window.storageMarketItems = {730: {'AWP | Lightning Strike (Factory New)': {value: 420.42}}};
            LoungeUser.userSettings.useCachedPriceList = '1';
            var item = new Item($(itemHtml));
            item.getMarketPrice(true);
            expect(item.marketPriced).to.equal(true);
            expect(item.marketValue).to.be.a('number');
        });

        it('should have market price appended without weapon quality to the item element', function() {
            window.storageMarketItems = {730: {'AWP | Lightning Strike (Factory New)': {value: 420.42}}};
            LoungeUser.userSettings.displayCsgoWeaponQuality = '0';
            var item = new Item($(itemHtml));
            item.getMarketPrice(true);
            var rarityText = $(item.item).find('.rarity').text();
            expect(rarityText).to.not.contain(item.weaponQualityAbbrevation);
            expect(rarityText).to.contain(item.marketValue);
        });

        it('should get market price from already marketed item list', function() {
            LoungeUser.userSettings.useCachedPriceList = '0';
            window.marketedItems = {'AWP | Lightning Strike (Factory New)': 13.77};

            var item = new Item($(itemHtml));
            item.getMarketPrice();
            expect(item).to.have.property('marketPriced');
            expect(item).to.have.property('marketValue');
            expect(item.marketValue).to.be.a('number');

        });

        it('should detect currency IDs and price value from all price strings', function() {
            // Important to have unicode characters escaped because the currency detection does not seem to work here otherwise :/
            var priceStrings = ["15,57\u20AC", "1206,94 p\u0443\u0431.", "R$ 67,43", "CHF 16.83", "\xA311.38", "$16.95 USD", "148,59 kr", "\xA5 2,055.46", "RM72.75", "P800.59", "Rp 233 986.32", "S$23.86", "\u0E3F611.94", "49,27 TL", "\u20A9 19,963.15", "Mex$ 289.47", "CDN$ 23.63", "NZ$ 25.07", "\xA5 109.97", "\u20B9 1,124.74", "CLP$ 11.798,90", "S/.57.40", "COL$ 56.702,38", "R 255.41", "NT$ 557.17", "63.71 SR", "HK$ 131.41", "62.33 AED"];
            for (var i = 0; i < priceStrings.length; i++) {
                var detectedValueAndCurr = detectCurrencyAndValueFromString(priceStrings[i]);
                console.log(detectedValueAndCurr);
                expect(detectedValueAndCurr['currencyId']).to.not.be.null;
                expect(detectedValueAndCurr['value']).to.be.a('number');
            }
        })
    });
});
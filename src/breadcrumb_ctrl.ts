/// <reference path="../typings/common.d.ts" />
/// <reference path="../typings/index.d.ts" />

import _ from "lodash";
import { PanelCtrl } from "app/plugins/sdk";
import { impressions } from "app/features/dashboard/impression_store";
import config from "app/core/config";
import "./breadcrumb.css!";

export interface IBreadcrumbScope extends ng.IScope {
    navigate: (url: string) => void;
}

class BreadcrumbCtrl extends PanelCtrl {
    static templateUrl = "module.html";
    backendSrv: any;
    dashboardList: {
        url: string;
        name: string;
    }[];
    currentDashboard: string;
    windowLocation: ng.ILocationService;
    panel: any;

    /**
     * Breadcrumb class constructor
     * @param {IBreadcrumbScope} $scope Angular scope
     * @param {ng.auto.IInjectorService} $injector Angluar injector service
     * @param {ng.ILocationService} $location Angular location service
     * @param {any} backendSrv Grafana backend callback
     */
    constructor($scope: IBreadcrumbScope, $injector: ng.auto.IInjectorService, $location: ng.ILocationService, backendSrv: any) {
        super($scope, $injector);
        // Init variables
        $scope.navigate = this.navigate.bind(this);
        this.backendSrv = backendSrv;
        this.dashboardList = [];
        this.windowLocation = $location;
        // Check for browser session storage and create one if it doesn't exist
        if (!sessionStorage.getItem("dashlist")) {
            sessionStorage.setItem("dashlist", "[]");
        }
        // Check if URL params has breadcrumb
        if ($location.search().breadcrumb) {
            const items = $location.search().breadcrumb.split(",");
            this.createDashboardList(items);
        } else {
            // If no URL params are given then get dashboard list from session storage
            this.dashboardList = JSON.parse(sessionStorage.getItem("dashlist"));
        }
        this.updateText();
        // Adding a mechanism for telling parent frame to navigate to new url
        // Add listener for route changes: If route has target-parameter then
        // tell parent window to navigate to given target
        // e.g. setting following url-link in some Grafana dashboard: ?target=/logs
        $scope.$on("$routeUpdate", () => {
            if ($location.search().target) {
                const messageObj = {
                    target: $location.search().target,
                    params: $location.search().params
                };
                window.top.postMessage(messageObj, "*");
            }
        });
    }

    /**
     * Create dashboard items
     * @param {string[]} items Array of dashboard ids
     */
    createDashboardList(items: string[]) {
        var dashIds = impressions.getDashboardOpened();
        // Fetch list of all dashboards from Grafana
        this.backendSrv.search({dashboardIds: dashIds, limit: this.panel.limit}).then((result: any) => {
            this.dashboardList = items.map((item: string) => {
                return {
                    url: "dashboard/db/" + item,
                    name: _.find(result, { uri: "db/" + item }).title
                }
            });
            // Update session storage
            sessionStorage.setItem("dashlist", JSON.stringify(this.dashboardList));
        });
    }

    /**
     * Update Breadcrumb items
     */
    updateText() {
        var dashIds = impressions.getDashboardOpened();
        // Fetch list of all dashboards from Grafana
        this.backendSrv.search({dashboardIds: dashIds, limit: this.panel.limit}).then((result: any) => {
            this.currentDashboard = window.location.pathname.split("/").pop();
            var uri = "db/" + this.currentDashboard;
            var obj: any = _.find(result, { uri: uri });
            // Add current dashboard to breadcrumb if it doesn't exist
            if (_.findIndex(this.dashboardList, { url: "dashboard/" + uri }) < 0) {
                this.dashboardList.push( { url: "dashboard/" + uri, name: obj.title } );
            }
            // Update session storage
            sessionStorage.setItem("dashlist", JSON.stringify(this.dashboardList));
            this.notifyContainerWindow();
        });
    }

    /**
     * Notify container window
     */
    notifyContainerWindow() {
        // Send message to uppper window
        const messageObj = {
            dashboard: window.location.pathname.split("/").pop(),
            breadcrumb: this.dashboardList
        }
        window.top.postMessage(messageObj, "*");
    }

    /**
     * Navigate to given dashboard
     * @param {string} url
     */
    navigate(url: string) {
        // Check if user is navigating backwards in breadcrumb and
        // remove all items that follow the selected item in that case
        const index = _.findIndex(this.dashboardList, { url: url });
        if (index > -1 && this.dashboardList.length >= index + 2) {
            this.dashboardList.splice(index + 1, this.dashboardList.length - index - 1);
            sessionStorage.setItem("dashlist", JSON.stringify(this.dashboardList));
        }
        this.windowLocation.path(url);
        this.notifyContainerWindow();
    }

}

export { BreadcrumbCtrl, BreadcrumbCtrl as PanelCtrl }

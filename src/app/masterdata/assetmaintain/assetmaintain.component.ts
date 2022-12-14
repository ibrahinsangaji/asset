import { Component, OnInit } from '@angular/core';
import { MasterService } from 'src/app/services/master.service';
import { BlockUI, NgBlockUI } from 'ng-block-ui';
import { ClrDatagridStringFilterInterface } from "@clr/angular";
import { Asset } from 'src/app/models';
import * as SecureLS from 'secure-ls';
import * as join from 'array-join';
import { ExcelService } from 'src/app/services/excel.service';
import { TransactService } from 'src/app/services/transact.service';

class TypeFilter implements ClrDatagridStringFilterInterface<any> {
  accepts(obj: any, search: string): boolean {
    return "" + obj.t_Name == search
      || obj.t_Name.toLowerCase().indexOf(search) >= 0;
  }
}

class BrandFilter implements ClrDatagridStringFilterInterface<any> {
  accepts(obj: any, search: string): boolean {
    return "" + obj.b_Name == search
      || obj.b_Name.toLowerCase().indexOf(search) >= 0;
  }
}

@Component({
  selector: 'app-assetmaintain',
  templateUrl: './assetmaintain.component.html',
  styleUrls: ['./assetmaintain.component.less']
})
export class AssetmaintainComponent implements OnInit {
  ls = new SecureLS();
  typeFilter = new TypeFilter();
  brandFilter = new BrandFilter();
  @BlockUI('grid-block') blockUIList: NgBlockUI;
  assetOri = [];
  assetData = [];
  assets = [];
  mType = [];
  mBrand = [];
  mRack = [];
  mStatus = [];
  fStatus = 0;
  fAssetNumber = "";
  opened = false;
  selectedUpdate = new Asset();

  listSw = [];
  selectedListSw = [];
  spec = "";
  saved = false;
  lock = false;
  loading=true;
  constructor(private masterService: MasterService, private transService: TransactService, private ecs : ExcelService) { }

  ngOnInit() {
    this.mBrand = this.ls.get("mbrand");
    this.mType = this.ls.get("mtype");
    this.mRack = this.ls.get("mrack");
    this.mStatus = this.ls.get("mparams");
    this.mStatus = this.mStatus.map(f => { f.EnumValue = +f.EnumValue; return f }).filter(f => f.EnumName === "StatusAsset" && f.RowStatus == 1);
    this.masterService.getAllSoftware().subscribe(res => {
      this.listSw = res;
    })
    this.fetchData();
  }

  customSearchFn(term: string, item: Asset) {
    term = term.toLocaleLowerCase();
    return item.AssetNumber.toLocaleLowerCase().indexOf(term) > -1 || item.AssetNumberSAP.toLocaleLowerCase().indexOf(term) > -1;
  }

  onChange($event) {
    console.log($event);
  }

  fetchData() {
    this.blockUIList.start();
    
    this.masterService.getAllAsset().subscribe(res => {
      this.assetOri = join.join(
        join.join(
          join.join(
            join.join(res, this.mBrand, { key: 'BrandCode', propMap2: p => 'b_' + p }), this.mType,
            { key: 'TypeCode', propMap2: p => 't_' + p }), this.mRack,
          { key: 'RackCode', propMap2: p => 'r_' + p }), this.mStatus,
        { key1: "Status", key2: "EnumValue", propMap2: p => 's_' + p });

      // console.log(this.assetOri);

      this.transService.getCurrentPosition({}).subscribe(resPos => {
        resPos.forEach(function(v){ delete v.BrandCode;
          delete v.GINo;
          delete v.Name;
          delete v.StatusAsset;
          delete v.StatusAssetOutHeader;
          delete v.TypeCode; });
        
        console.log(resPos)
        for(let i=0; i<this.assetOri.length; i++) {
          var tempFInd = resPos.find((itmInner) => itmInner.AssetNumber === this.assetOri[i].AssetNumber)
          if(tempFInd != null || tempFInd != undefined){
            this.assetOri[i].PIC = tempFInd.PIC
            this.assetOri[i].ReceiverFunction = tempFInd.ReceiverFunction
          }
          // merged.push({
          //  ...this.assetOri[i], 
          //  ...(resPos.find((itmInner) => itmInner.AssetNumber === this.assetOri[i].AssetNumber))}
          // );
        }
        // console.log(this.assetOri)
        this.assetData = this.assetOri
        this.masterService.getAllFunctions().subscribe(resFunction => {
          this.masterService.getAllLocation().subscribe(resLoc => {
            // console.log(resLoc)
            // console.log(resFunction)
            for (let index = 0; index < this.assetOri.length; index++) {
              var tempFunction = resFunction.find(itm => itm.FunctionCode === this.assetOri[index].ReceiverFunction)
              if(tempFunction != undefined || tempFunction != null){
                var tempLoc = resLoc.find(itmf => itmf.LocationCode === tempFunction.LocationCode)
                if(tempLoc != null || tempLoc != undefined){
                  // console.log(tempLoc)
                  this.assetOri[index].LocationCode = tempLoc.LocationCode
                  this.assetOri[index].NameLocation = tempLoc.Name
                  this.assetOri[index].CategoryLocation = tempLoc.CategoryLocation
                }
                // lastMerge.push({
                //   ...merged[index],
                //   ...tempLoc,
                // })
                
              }
              
            }
          })
        })
      })
      this.assets = this.assetOri;
      console.log(this.assets)
      this.blockUIList.stop();
    });
  }
  searchAsset() {
    this.assets = this.assetOri;
    this.assets = this.assets.filter(f => f.AssetNumber.toLowerCase().indexOf(this.fAssetNumber.toLowerCase()) >= 0);
    if (this.fStatus != 0) {
      this.assets = this.assets.filter(f => f.Status == this.fStatus);
    }
  }

  keypressInBox(e) {
    let code = (e.keyCode ? e.keyCode : e.which);
    if (code == 13) { //Enter keycode                        
      e.preventDefault();
      this.searchAsset();
    }
  }

  updateAsset() {
    this.lock = true;
    this.selectedUpdate.Software = this.selectedListSw;
    this.masterService.putAsset(this.selectedUpdate).subscribe(res => {
      if (res.success) {
        this.saved = true;
        setTimeout(() => {
          this.lock = false;
          this.opened = false;
          this.saved = false;
          this.fetchData();
        }, 1500);

      }
    })
  }

  viewDetail(obj) {
    this.loading=true;
    this.selectedListSw = [];
    this.selectedUpdate = obj;
    if (obj.Software) {
      obj.Software.forEach(el => {
        el.Name =  this.listSw.find(f=>f.SWCode == el.SWCode).Name;
        this.selectedListSw = [...this.selectedListSw, el];
      });
      
    }
    setTimeout(() => {
      this.loading = false;
    }, 2000); 
    this.opened = true;
  }

  exportData() {
    var exportData = []
    this.assets.forEach(element => {
      var tempExport = {}
      tempExport['Name (SAP Based)'] = element.Name
      tempExport['Suggest Name (SAP Based)'] = null
      tempExport['Additional Description'] = element.PIC
      tempExport['Asset Number'] = element.AssetNumber
      tempExport['Asset Main Number Text'] = element.AssetNumberSAP
      tempExport['Tag Number'] = element.AssetNumberSAP
      tempExport['Serial Number'] = null
      tempExport['License Plat Number'] = null
      tempExport['Last Inventory On'] = null
      tempExport['Asset Status_Code'] = element.s_RowStatus
      switch (element.s_RowStatus) {
        case 1:
          tempExport['Asset Status_Description'] = 'Very Good-Used'
          break;
        case 2:
          tempExport['Asset Status_Description'] = 'Good-Used'
          break;
        case 3:
          tempExport['Asset Status_Description'] = 'Not Good'
          break;
        case 4:
          tempExport['Asset Status_Description'] = 'Damaged'
          break;
        case 5:
          tempExport['Asset Status_Description'] = 'Lost'
          break;
      }
      tempExport['Tag Status_Code'] = null
      tempExport['Tag Status_Description'] = null
      tempExport['Asset type_Code'] = null
      tempExport['Asset type_Description'] = element.t_Name
      tempExport['Asset type_Description(Brand)'] = element.b_Name
      tempExport['Location of assete_Code'] = null
      tempExport['Location of assete_Name Location'] = element.NameLocation
      tempExport['Location of assete_Function'] = element.ReceiverFunction
      tempExport['Location of assete_LocationCode'] = element.LocationCode
      tempExport['Location of assete_Category'] = element.CategoryLocation
      tempExport['Status'] = null
      tempExport['Keterangan'] = element.Spec
      tempExport['Create Date'] = element.CreateDate
      tempExport['Update Datee'] = element.UpdateDate
      tempExport['Update By'] = element.UpdateBy
      tempExport['Software'] = element.Software

      exportData.push(tempExport)
    });

    this.ecs.exportAsExcelFile(exportData, "asset-IT");
  }
}
